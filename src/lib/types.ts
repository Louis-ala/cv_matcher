export type ProviderId = "anthropic" | "openai" | "gemini" | "mistral";

export interface Settings {
  provider: ProviderId;
  models: Record<ProviderId, string>;
  apiKeys: Record<ProviderId, string>;
  apifyToken: string;
  /** true : mémorisé dans ce navigateur (localStorage) ; false : effacé à la fermeture de l'onglet. */
  remember: boolean;
  /** Plafond de dépense Apify par recherche et par source, en dollars. */
  apifyMaxUsd: number;
}

export interface Experience {
  poste: string;
  entreprise: string;
  periode: string;
  points: string[];
}

export interface Profile {
  nom: string;
  email: string;
  telephone: string;
  titre: string;
  resume: string;
  localisation: string;
  anneesExperience: number;
  competences: string[];
  langues: string[];
  experiences: Experience[];
  formations: string[];
  requetes: string[];
}

export type SourceId = "indeed" | "wttj";

export interface SearchCriteria {
  query: string;
  location: string;
  sources: Record<SourceId, boolean>;
  limit: number;
  datePosted: "1" | "3" | "7" | "14" | "30";
}

export interface Match {
  score: number;
  resume: string;
  pointsForts: string[];
  lacunes: string[];
}

export interface Offer {
  id: string;
  source: SourceId;
  title: string;
  company: string;
  location: string;
  url: string;
  applyUrl: string;
  salary?: string;
  contract?: string;
  remote?: string;
  publishedAt?: string;
  description: string;
  companyDescription?: string;
  companyWebsite?: string;
  match?: Match;
}

export interface LetterParagraph {
  texte: string;
  source: string;
}

export interface Letter {
  objet: string;
  salutation: string;
  paragraphes: LetterParagraph[];
  formule: string;
  generatedAt: string;
}

export interface InterviewQuestion {
  categorie: string;
  question: string;
  intention: string;
  reponse: string;
  appui: string;
}

export interface Interview {
  questions: InterviewQuestion[];
  generatedAt: string;
}

export interface Dossier {
  letter?: Letter;
  interview?: Interview;
  applied?: boolean;
}

export interface AppData {
  cvFileName?: string;
  cvText?: string;
  cvPages?: number;
  profile?: Profile;
  criteria?: SearchCriteria;
  offers: Offer[];
  dossiers: Record<string, Dossier>;
  lastSearchAt?: string;
}

export type JobPhase = "idle" | "running" | "done" | "error";

export interface JobStatus {
  phase: JobPhase;
  label: string;
  detail?: string;
}
