import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ACTORS, searchSource } from "../lib/apify";

import { analyzeCv, prepareInterview, scoreOffers, writeLetter } from "../lib/prompts";
import { providerInfo } from "../lib/providers";
import { clearData, emptyData, loadData, loadSettings, saveData, saveSettings } from "../lib/storage";
import type { AppData, Dossier, JobStatus, Letter, Offer, SearchCriteria, Settings, SourceId } from "../lib/types";

type JobKey = "cv" | "search" | `letter:${string}` | `interview:${string}`;

interface AppState {
  settings: Settings;
  data: AppData;
  jobs: Partial<Record<JobKey, JobStatus>>;
  aiReady: boolean;
  apifyReady: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  loadCv: (file: File) => Promise<void>;
  analyze: () => Promise<void>;
  updateProfile: (patch: Partial<NonNullable<AppData["profile"]>>) => void;
  search: (criteria: SearchCriteria) => Promise<boolean>;
  rescore: () => Promise<void>;
  generateLetter: (offerId: string, instruction?: string) => Promise<void>;
  saveLetter: (offerId: string, letter: Letter) => void;
  generateInterview: (offerId: string) => Promise<void>;
  setApplied: (offerId: string, applied: boolean) => void;
  resetData: () => void;
}

const Ctx = createContext<AppState | null>(null);

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const dedupeKey = (o: Offer) => `${o.title}|${o.company}`.toLowerCase().replace(/\s+/g, " ").trim();

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [data, setData] = useState<AppData>(loadData);
  const [jobs, setJobs] = useState<AppState["jobs"]>({});
  const dataRef = useRef(data);
  dataRef.current = data;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveData(data), [data]);

  const setJob = useCallback((key: JobKey, status: JobStatus | undefined) => {
    setJobs((j) => ({ ...j, [key]: status }));
  }, []);

  const patchDossier = useCallback((offerId: string, patch: Partial<Dossier>) => {
    setData((d) => ({ ...d, dossiers: { ...d.dossiers, [offerId]: { ...d.dossiers[offerId], ...patch } } }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const loadCv = useCallback(
    async (file: File) => {
      setJob("cv", { phase: "running", label: "Lecture du PDF…" });
      try {
        if (file.type && file.type !== "application/pdf") throw new Error("Ce fichier n'est pas un PDF.");
        const { extractPdfText } = await import("../lib/pdf");
        const { text, pages } = await extractPdfText(file);
        if (text.length < 80) {
          throw new Error("Ce PDF ne contient presque pas de texte (CV scanné en image ?). Exportez-le depuis Word, Canva ou Google Docs en PDF texte.");
        }
        setData((d) => ({ ...d, cvFileName: file.name, cvText: text, cvPages: pages, profile: undefined }));
        setJob("cv", { phase: "done", label: `${pages} page${pages > 1 ? "s" : ""} lue${pages > 1 ? "s" : ""}` });
      } catch (e) {
        setJob("cv", { phase: "error", label: "Lecture impossible", detail: errorText(e) });
      }
    },
    [setJob],
  );

  const analyze = useCallback(async () => {
    const text = dataRef.current.cvText;
    if (!text) return;
    setJob("cv", { phase: "running", label: `Analyse du CV par ${providerInfo(settingsRef.current.provider).name}…` });
    try {
      const profile = await analyzeCv(settingsRef.current, text);
      setData((d) => ({
        ...d,
        profile,
        criteria: {
          query: profile.requetes[0] ?? profile.titre,
          location: profile.localisation,
          sources: { indeed: true, wttj: true, linkedin: true },
          limit: d.criteria?.limit ?? 15,
          datePosted: d.criteria?.datePosted ?? "14",
        },
      }));
      setJob("cv", { phase: "done", label: "Profil extrait" });
    } catch (e) {
      setJob("cv", { phase: "error", label: "Analyse impossible", detail: errorText(e) });
    }
  }, [setJob]);

  const updateProfile = useCallback<AppState["updateProfile"]>((patch) => {
    setData((d) => (d.profile ? { ...d, profile: { ...d.profile, ...patch } } : d));
  }, []);

  const scoreAll = useCallback(
    async (offers: Offer[]) => {
      const profile = dataRef.current.profile;
      if (!profile) return;
      const todo = offers.filter((o) => !o.match);
      const size = 8;
      for (let i = 0; i < todo.length; i += size) {
        const chunk = todo.slice(i, i + size);
        setJob("search", {
          phase: "running",
          label: "Notation des offres…",
          detail: `${Math.min(i + size, todo.length)} / ${todo.length} offres évaluées par ${providerInfo(settingsRef.current.provider).name}`,
        });
        const results = await scoreOffers(settingsRef.current, profile, chunk);
        const byId = new Map(results.map((r) => [r.id, r]));
        setData((d) => ({
          ...d,
          offers: d.offers.map((o) => {
            const r = byId.get(o.id);
            if (!r) return o;
            const { id: _id, ...match } = r;
            return { ...o, match: { ...match, score: Math.max(0, Math.min(100, Math.round(match.score))) } };
          }),
        }));
      }
    },
    [setJob],
  );

  const search = useCallback(
    async (criteria: SearchCriteria) => {
      const s = settingsRef.current;
      setData((d) => ({ ...d, criteria }));
      const sources = (Object.keys(criteria.sources) as SourceId[]).filter((k) => criteria.sources[k]);
      setJob("search", {
        phase: "running",
        label: "Recherche des offres…",
        detail: `Apify interroge ${sources.map((k) => ACTORS[k].label).join(", ").replace(/, ([^,]*)$/, " et $1")}. Comptez 10 à 60 secondes.`,
      });
      try {
        const settled = await Promise.allSettled(sources.map((src) => searchSource(src, criteria, s.apifyToken, s.apifyMaxUsd)));
        const found: Offer[] = [];
        const failures: string[] = [];
        settled.forEach((r, i) => {
          if (r.status === "fulfilled") found.push(...r.value);
          else failures.push(`${ACTORS[sources[i]].label} : ${errorText(r.reason)}`);
        });
        if (found.length === 0) {
          throw new Error(failures.length ? failures.join(" · ") : "Aucune offre trouvée. Élargissez la recherche (autre intitulé, lieu, période).");
        }
        const seen = new Set<string>();
        const unique = found.filter((o) => {
          const k = dedupeKey(o);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        // Les offres déjà notées gardent leur note ; les nouvelles s'ajoutent.
        const previous = new Map(dataRef.current.offers.map((o) => [o.id, o]));
        const merged = unique.map((o) => ({ ...o, match: previous.get(o.id)?.match }));
        setData((d) => ({ ...d, offers: merged, lastSearchAt: new Date().toISOString() }));
        await scoreAll(merged);
        setJob("search", {
          phase: "done",
          label: `${merged.length} offres trouvées et notées`,
          detail: failures.length ? `Source en échec — ${failures.join(" · ")}` : undefined,
        });
        return true;
      } catch (e) {
        setJob("search", { phase: "error", label: "Recherche interrompue", detail: errorText(e) });
        return false;
      }
    },
    [scoreAll, setJob],
  );

  const rescore = useCallback(async () => {
    try {
      await scoreAll(dataRef.current.offers);
      setJob("search", { phase: "done", label: "Offres notées" });
    } catch (e) {
      setJob("search", { phase: "error", label: "Notation interrompue", detail: errorText(e) });
    }
  }, [scoreAll, setJob]);

  const findOffer = (id: string) => dataRef.current.offers.find((o) => o.id === id);

  const generateLetter = useCallback(
    async (offerId: string, instruction?: string) => {
      const offer = findOffer(offerId);
      const { profile, cvText } = dataRef.current;
      if (!offer || !profile || !cvText) return;
      const key: JobKey = `letter:${offerId}`;
      setJob(key, { phase: "running", label: `Rédaction de la lettre pour ${offer.company}…` });
      try {
        const letter = await writeLetter(settingsRef.current, profile, cvText, offer, instruction);
        patchDossier(offerId, { letter: { ...letter, generatedAt: new Date().toISOString() } });
        setJob(key, undefined);
      } catch (e) {
        setJob(key, { phase: "error", label: "Rédaction impossible", detail: errorText(e) });
      }
    },
    [patchDossier, setJob],
  );

  const generateInterview = useCallback(
    async (offerId: string) => {
      const offer = findOffer(offerId);
      const { profile, cvText } = dataRef.current;
      if (!offer || !profile || !cvText) return;
      const key: JobKey = `interview:${offerId}`;
      setJob(key, { phase: "running", label: "Préparation des questions d'entretien…" });
      try {
        const interview = await prepareInterview(settingsRef.current, profile, cvText, offer);
        patchDossier(offerId, { interview: { ...interview, generatedAt: new Date().toISOString() } });
        setJob(key, undefined);
      } catch (e) {
        setJob(key, { phase: "error", label: "Préparation impossible", detail: errorText(e) });
      }
    },
    [patchDossier, setJob],
  );

  const saveLetter = useCallback((offerId: string, letter: Letter) => patchDossier(offerId, { letter }), [patchDossier]);
  const setApplied = useCallback((offerId: string, applied: boolean) => patchDossier(offerId, { applied }), [patchDossier]);

  const resetData = useCallback(() => {
    clearData();
    setData(emptyData);
    setJobs({});
  }, []);

  const value = useMemo<AppState>(
    () => ({
      settings,
      data,
      jobs,
      aiReady: Boolean(settings.apiKeys[settings.provider] && settings.models[settings.provider]),
      apifyReady: Boolean(settings.apifyToken),
      updateSettings,
      loadCv,
      analyze,
      updateProfile,
      search,
      rescore,
      generateLetter,
      saveLetter,
      generateInterview,
      setApplied,
      resetData,
    }),
    [settings, data, jobs, updateSettings, loadCv, analyze, updateProfile, search, rescore, generateLetter, saveLetter, generateInterview, setApplied, resetData],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp doit être utilisé dans <AppProvider>");
  return v;
}
