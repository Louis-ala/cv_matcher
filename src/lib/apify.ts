import type { Offer, SearchCriteria, SourceId } from "./types";

export const ACTORS: Record<SourceId, { actor: string; label: string; store: string }> = {
  indeed: {
    actor: "valig/indeed-jobs-scraper",
    label: "Indeed",
    store: "https://apify.com/valig/indeed-jobs-scraper",
  },
  wttj: {
    actor: "clearpath/welcome-to-the-jungle-jobs-api",
    label: "Welcome to the Jungle",
    store: "https://apify.com/clearpath/welcome-to-the-jungle-jobs-api",
  },
};

export class ApifyError extends Error {}

const API = () => `${window.location.origin}/api/apify/v2`;

async function apifyFetch(path: string, token: string, init: RequestInit = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApifyError("Apify est injoignable. Vérifiez votre connexion et que l'app tourne via « npm run dev ».");
  }
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? text.slice(0, 200);
    if (res.status === 401) throw new ApifyError("Token Apify refusé (401). Vérifiez-le dans Réglages.");
    if (res.status === 402) throw new ApifyError(`Crédit Apify insuffisant (402). ${msg}`);
    if (res.status === 408) throw new ApifyError("La recherche Apify a dépassé le temps imparti. Réduisez le nombre d'offres.");
    throw new ApifyError(`Erreur Apify ${res.status} : ${msg}`);
  }
  return body;
}

/** Vérifie le token et renvoie le nom d'utilisateur Apify. */
export async function checkApifyToken(token: string): Promise<string> {
  if (!token) throw new ApifyError("Saisissez d'abord un token.");
  const body = await apifyFetch("/users/me", token);
  return body?.data?.username ?? "compte Apify";
}

async function runActorSync(token: string, actor: string, input: unknown, maxUsd: number): Promise<any[]> {
  const id = actor.replace("/", "~");
  const params = new URLSearchParams({ timeout: "280", clean: "true", format: "json", maxTotalChargeUsd: String(maxUsd) });
  const body = await apifyFetch(`/acts/${id}/run-sync-get-dataset-items?${params}`, token, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return Array.isArray(body) ? body : [];
}

export function htmlToText(html?: string | null): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html.replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, "$&\n"), "text/html");
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function formatSalary(min?: number | null, max?: number | null, currency?: string | null, period?: string | null) {
  if (!min && !max) return undefined;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
  const cur = currency === "EUR" || !currency ? "€" : currency;
  const per: Record<string, string> = { yearly: "/an", YEAR: "/an", monthly: "/mois", MONTH: "/mois", daily: "/jour", DAY: "/jour", hourly: "/h", HOUR: "/h" };
  const range = min && max && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt((min ?? max)!);
  return `${range} ${cur}${period ? per[period] ?? "" : ""}`;
}

const CONTRACTS: Record<string, string> = {
  full_time: "CDI", temporary: "Intérim", internship: "Stage", apprenticeship: "Alternance", freelance: "Freelance",
  vie: "VIE", part_time: "Temps partiel", fixed_term: "CDD", graduate_program: "Programme jeunes diplômés", other: "Autre",
};
const REMOTE: Record<string, string> = {
  no: "Pas de télétravail", partial: "Télétravail partiel", punctual: "Télétravail occasionnel", fulltime: "Full remote",
};

function normalizeIndeed(item: any): Offer | null {
  if (!item?.key || !item?.title || item.expired === true) return null;
  const loc = [item.location?.city, item.location?.countryName].filter(Boolean).join(", ");
  return {
    id: `indeed-${item.key}`,
    source: "indeed",
    title: item.title,
    company: item.employer?.name ?? "Entreprise non précisée",
    location: loc || "Non précisé",
    url: item.url,
    applyUrl: item.jobUrl || item.url,
    salary: formatSalary(item.baseSalary?.min, item.baseSalary?.max, item.baseSalary?.currencyCode, item.baseSalary?.unitOfWork),
    publishedAt: item.datePublished ?? item.dateOnIndeed,
    description: item.description?.text ?? htmlToText(item.description?.html),
    companyDescription: item.employer?.briefDescription || undefined,
    companyWebsite: item.employer?.corporateWebsite || undefined,
  };
}

function normalizeWttj(item: any): Offer | null {
  if (!item?.id || !item?.name) return null;
  const office = item.offices?.[0];
  const sections = [
    item.summary,
    htmlToText(item.description),
    item.profile ? `Profil recherché\n${htmlToText(item.profile)}` : "",
    item.recruitmentProcess ? `Processus de recrutement\n${htmlToText(item.recruitmentProcess)}` : "",
  ].filter(Boolean);
  return {
    id: `wttj-${item.id}`,
    source: "wttj",
    title: item.name,
    company: item.organizationName ?? "Entreprise non précisée",
    location: office ? [office.city, office.country_code].filter(Boolean).join(", ") : "Non précisé",
    url: item.url,
    applyUrl: item.applyUrl || item.url,
    salary: formatSalary(item.salaryMin, item.salaryMax, item.salaryCurrency, item.salaryPeriod),
    contract: CONTRACTS[item.contractType] ?? item.contractType,
    remote: REMOTE[item.remote],
    publishedAt: item.publishedAt,
    description: sections.join("\n\n"),
    companyDescription: htmlToText(item.organizationDescription) || undefined,
    companyWebsite: item.organizationWebsite || undefined,
  };
}

export async function searchSource(
  source: SourceId,
  criteria: SearchCriteria,
  token: string,
  maxUsd: number,
): Promise<Offer[]> {
  if (source === "indeed") {
    const input: Record<string, unknown> = {
      country: "fr",
      title: criteria.query,
      location: criteria.location || undefined,
      limit: criteria.limit,
    };
    if (criteria.datePosted !== "30") input.datePosted = criteria.datePosted;
    const items = await runActorSync(token, ACTORS.indeed.actor, input, maxUsd);
    return items.map(normalizeIndeed).filter((o): o is Offer => o !== null);
  }
  const items = await runActorSync(
    token,
    ACTORS.wttj.actor,
    {
      query: criteria.query,
      location: criteria.location || undefined,
      maxItems: criteria.limit,
      includeDetails: true,
      websiteCountry: "fr",
      sortBy: "relevance",
      datePosted: criteria.datePosted,
    },
    maxUsd,
  );
  return items.map(normalizeWttj).filter((o): o is Offer => o !== null);
}
