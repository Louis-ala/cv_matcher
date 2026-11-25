import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon, Row, Status } from "../components/ui";
import { ACTORS } from "../lib/apify";
import { providerInfo } from "../lib/providers";
import type { SearchCriteria, SourceId } from "../lib/types";
import { useApp } from "../state/AppState";

function TagEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <ul className="tags">
        {values.map((v) => (
          <li key={v}>
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Retirer ${v}`}>×</button>
          </li>
        ))}
        <li className="tags__add">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ajouter…" aria-label={`Ajouter : ${label}`}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} />
        </li>
      </ul>
    </div>
  );
}

export default function CvPage() {
  const { data, jobs, aiReady, apifyReady, settings, loadCv, analyze, updateProfile, search } = useApp();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [criteria, setCriteria] = useState<SearchCriteria | undefined>(data.criteria);
  const cvJob = jobs.cv;
  const searchJob = jobs.search;
  const busy = cvJob?.phase === "running";
  const searching = searchJob?.phase === "running";
  const p = data.profile;

  useEffect(() => setCriteria(data.criteria), [data.criteria]);

  const onFile = async (file?: File) => {
    if (!file) return;
    await loadCv(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files[0]);
  };

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!criteria) return;
    const ok = await search(criteria);
    if (ok) navigate("/offres");
  };

  const set = <K extends keyof SearchCriteria>(k: K, v: SearchCriteria[K]) => criteria && setCriteria({ ...criteria, [k]: v });
  const noSource = criteria && !Object.values(criteria.sources).some(Boolean);

  return (
    <div className="page cv">
      <Row note={<span className="hand">Mon CV</span>}>
        <h1>Votre CV, lu dans le navigateur</h1>
        <p className="lede">Le PDF ne quitte pas votre ordinateur : seul son texte est envoyé à {providerInfo(settings.provider).name} pour l'analyse.</p>
        {!aiReady && (
          <p className="warn"><Icon name="alert" /> Ajoutez d'abord une clé d'IA dans <Link to="/reglages">Réglages</Link>.</p>
        )}
      </Row>

      <Row note={<span className="hand">1. Le fichier</span>}>
        <label
          className={`drop ${dragging ? "is-over" : ""} ${data.cvText ? "has-file" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy}
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <Icon name={data.cvText ? "file" : "upload"} size={28} />
          {data.cvText ? (
            <span>
              <strong>{data.cvFileName}</strong>
              <span>{data.cvPages} page{(data.cvPages ?? 1) > 1 ? "s" : ""} · {data.cvText.length.toLocaleString("fr-FR")} caractères lus. Cliquez ou déposez un autre PDF pour le remplacer.</span>
            </span>
          ) : (
            <span>
              <strong>Déposez votre CV ici</strong>
              <span>ou cliquez pour choisir un fichier PDF (texte, pas une image scannée).</span>
            </span>
          )}
        </label>
        {data.cvText && !p && (
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={() => void analyze()} disabled={!aiReady || busy}>
              <Icon name="pen" /> Analyser le CV
            </button>
            <span className="cost">1 appel à {providerInfo(settings.provider).name}</span>
          </div>
        )}
        <Status job={cvJob} />
      </Row>

      {p && (
        <Row note={<><span className="hand">2. Le profil</span><span className="note-small">Corrigez si besoin : tout le reste s'appuie dessus.</span></>}>
          <section className="profile" aria-labelledby="profile-title">
            <div className="profile__head">
              <div>
                <h2 id="profile-title">{p.nom || "Candidat"}</h2>
                <p>{p.titre} · {p.anneesExperience} an{p.anneesExperience > 1 ? "s" : ""} d'expérience · {p.localisation || "lieu non précisé"}</p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => void analyze()} disabled={!aiReady || busy}>
                <Icon name="refresh" /> Réanalyser
              </button>
            </div>
            <p className="profile__resume">{p.resume}</p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="pf-email">E-mail (pour la lettre)</label>
                <input id="pf-email" value={p.email} onChange={(e) => updateProfile({ email: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-tel">Téléphone</label>
                <input id="pf-tel" value={p.telephone} onChange={(e) => updateProfile({ telephone: e.target.value })} />
              </div>
            </div>
            <TagEditor label="Compétences" values={p.competences} onChange={(v) => updateProfile({ competences: v })} />
            <details className="xp">
              <summary>{p.experiences.length} expérience{p.experiences.length > 1 ? "s" : ""} lue{p.experiences.length > 1 ? "s" : ""} dans le CV</summary>
              <ul>
                {p.experiences.map((x, i) => (
                  <li key={i}><strong>{x.poste}</strong> — {x.entreprise} <span className="muted">({x.periode})</span></li>
                ))}
              </ul>
            </details>
          </section>
        </Row>
      )}

      {p && criteria && (
        <Row note={<><span className="hand">3. La recherche</span><span className="note-small">Puis chaque offre est notée par l'IA.</span></>}>
          <form className="block" onSubmit={onSearch} aria-labelledby="search-title">
            <h2 id="search-title">Chercher des offres</h2>
            <div className="field">
              <span className="field__label">Intitulés suggérés</span>
              <div className="chips">
                {p.requetes.map((q) => (
                  <button key={q} type="button" className={`chip ${criteria.query === q ? "is-on" : ""}`} onClick={() => set("query", q)}>{q}</button>
                ))}
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="q">Poste recherché</label>
                <input id="q" required value={criteria.query} onChange={(e) => set("query", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="loc">Lieu</label>
                <input id="loc" value={criteria.location} placeholder="Paris, Lyon, remote…" onChange={(e) => set("location", e.target.value)} />
              </div>
            </div>
            <div className="grid-3">
              <fieldset className="field">
                <legend className="field__label">Sources</legend>
                {(Object.keys(ACTORS) as SourceId[]).map((k) => (
                  <label key={k} className="toggle">
                    <input type="checkbox" checked={!!criteria.sources[k]} onChange={(e) => set("sources", { ...criteria.sources, [k]: e.target.checked })} />
                    <span>{ACTORS[k].label}</span>
                  </label>
                ))}
              </fieldset>
              <div className="field">
                <label htmlFor="lim">Offres par source</label>
                <input id="lim" type="number" min={5} max={50} value={criteria.limit}
                  onChange={(e) => set("limit", Math.min(50, Math.max(5, Number(e.target.value) || 15)))} />
              </div>
              <div className="field">
                <label htmlFor="date">Publiées depuis</label>
                <select id="date" value={criteria.datePosted} onChange={(e) => set("datePosted", e.target.value as SearchCriteria["datePosted"])}>
                  <option value="1">24 heures</option>
                  <option value="3">3 jours</option>
                  <option value="7">7 jours</option>
                  <option value="14">14 jours</option>
                  <option value="30">30 jours</option>
                </select>
              </div>
            </div>
            {!apifyReady && <p className="warn"><Icon name="alert" /> Ajoutez votre token Apify dans <Link to="/reglages">Réglages</Link>.</p>}
            <div className="actions">
              <button type="submit" className="btn btn--primary btn--lg" disabled={!apifyReady || !aiReady || searching || noSource}>
                <Icon name="search" /> Chercher et noter les offres
              </button>
              <span className="cost">Apify (max. {settings.apifyMaxUsd.toLocaleString("fr-FR")} $ par source) + {Math.ceil((criteria.limit * 2) / 8)} appels IA environ</span>
            </div>
            <Status job={searchJob} />
          </form>
        </Row>
      )}
    </div>
  );
}
