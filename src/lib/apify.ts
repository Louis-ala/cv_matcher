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
  linkedin: {
    actor: "valig/linkedin-jobs-scraper",
    label: "LinkedIn",
    store: "https://apify.com/valig/linkedin-jobs-scraper",
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

/** Premier champ non vide parmi plusieurs noms possibles (l'actor ne publie pas son schéma de sortie). */
function pick(item: any, ...keys: string[]): any {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o == null ? undefined : o[p]), item);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function toIsoDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

const LINKEDIN_CONTRACTS: Record<string, string> = {
  "full-time": "CDI", full_time: "CDI", fulltime: "CDI", "temps plein": "CDI",
  "part-time": "Temps partiel", part_time: "Temps partiel", contract: "CDD", temporary: "Intérim",
  internship: "Stage", stage: "Stage", volunteer: "Bénévolat", other: "Autre",
};
const LINKEDIN_REMOTE: Record<string, string> = {
  remote: "Full remote", "on-site": "Pas de télétravail", onsite: "Pas de télétravail", hybrid: "Télétravail partiel",
};

function normalizeLinkedin(item: any): Offer | null {
  const id = pick(item, "id", "jobId", "job_id");
  const title = pick(item, "title", "jobTitle", "job_title");
  if (!id || !title) return null;
  const url = pick(item, "url", "jobUrl", "link", "job_url") ?? `https://www.linkedin.com/jobs/view/${id}`;
  const contractRaw = pick(item, "employmentType", "contractType", "jobType", "employment_type");
  const remoteRaw = pick(item, "workType", "workplaceType", "remote", "workRemoteAllowed");
  const salary =
    typeof item.salary === "string"
      ? item.salary
      : formatSalary(
          pick(item, "salary.min", "salaryMin", "baseSalary.min"),
          pick(item, "salary.max", "salaryMax", "baseSalary.max"),
          pick(item, "salary.currency", "salaryCurrency", "baseSalary.currencyCode"),
          pick(item, "salary.period", "salaryPeriod", "baseSalary.unitOfWork"),
        );
  const company = pick(item, "companyName", "company.name", "employer.name", "company");
  return {
    id: `linkedin-${id}`,
    source: "linkedin",
    title: String(title),
    company: typeof company === "string" ? company : "Entreprise non précisée",
    location: String(pick(item, "location", "formattedLocation", "jobLocation", "place") ?? "Non précisé"),
    url,
    applyUrl: pick(item, "applyUrl", "applicationUrl", "apply_url", "externalApplyUrl") ?? url,
    salary,
    contract: contractRaw ? LINKEDIN_CONTRACTS[String(contractRaw).toLowerCase()] ?? String(contractRaw) : undefined,
    remote:
      remoteRaw === true ? "Full remote" : typeof remoteRaw === "string" ? LINKEDIN_REMOTE[remoteRaw.toLowerCase()] : undefined,
    publishedAt: toIsoDate(pick(item, "postedAt", "postedDate", "publishedAt", "datePosted", "listedAt", "postedTime")),
    description:
      pick(item, "descriptionText", "description_text", "description.text") ??
      htmlToText(pick(item, "descriptionHtml", "description_html", "description.html", "description")),
    companyDescription: pick(item, "companyDescription", "company.description") || undefined,
    companyWebsite: pick(item, "companyWebsite", "company.website") || undefined,
  };
}

/** LinkedIn ne propose que 24 h, 7 jours et 30 jours : on prend la fenêtre qui couvre la demande, puis on filtre. */
const LINKEDIN_DATE: Record<SearchCriteria["datePosted"], string> = {
  "1": "r86400", "3": "r604800", "7": "r604800", "14": "r2592000", "30": "r2592000",
};

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
  if (source === "linkedin") {
    const items = await runActorSync(
      token,
      ACTORS.linkedin.actor,
      {
        keywords: criteria.query,
        location: criteria.location || "France",
        datePosted: LINKEDIN_DATE[criteria.datePosted],
        limit: criteria.limit,
      },
      maxUsd,
    );
    const since = Date.now() - Number(criteria.datePosted) * 86_400_000;
    const seen = new Set<string>();
    return items
      .map(normalizeLinkedin)
      .filter((o): o is Offer => o !== null)
      .filter((o) => !o.publishedAt || Date.parse(o.publishedAt) >= since)
      .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
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
