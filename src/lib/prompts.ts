import { completeJson } from "./providers";
import type { Interview, Letter, Match, Offer, Profile, Settings } from "./types";

// Schémas stricts : additionalProperties false et tous les champs requis
// (compatibles avec les sorties structurées d'Anthropic et lisibles par les autres fournisseurs).
const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const HONESTY =
  "Règle absolue : n'invente jamais d'expérience, de diplôme, de chiffre ou de compétence absents du CV. " +
  "Si une information manque, contourne-la honnêtement. Écris en français, avec un ton professionnel et naturel.";

const clip = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? "");

const profileSchema = obj({
  nom: str,
  email: str,
  telephone: str,
  titre: str,
  resume: str,
  localisation: str,
  anneesExperience: { type: "number" },
  competences: strArr,
  langues: strArr,
  experiences: { type: "array", items: obj({ poste: str, entreprise: str, periode: str, points: strArr }) },
  formations: strArr,
  requetes: strArr,
});

export function analyzeCv(settings: Settings, cvText: string) {
  return completeJson<Profile>(settings, {
    schemaName: "profil",
    schema: profileSchema,
    effort: "low",
    system: `Tu es un recruteur expert du marché de l'emploi français. Tu extrais un profil structuré d'un CV. ${HONESTY}`,
    user:
      "Voici le texte brut d'un CV (extrait d'un PDF, la mise en page peut être abîmée).\n" +
      "Extrais le profil. Champs absents : chaîne vide. anneesExperience : estimation entière à partir des dates. " +
      "competences : 8 à 20 compétences concrètes (techniques et métier). " +
      "requetes : 3 à 5 intitulés de poste courts que la personne devrait chercher sur Indeed (ex. « Développeur React »), du plus pertinent au moins pertinent.\n\n" +
      `<cv>\n${clip(cvText, 30000)}\n</cv>`,
  });
}

function profileBrief(p: Profile) {
  return [
    `Titre : ${p.titre}`,
    `Localisation : ${p.localisation}`,
    `Expérience : ${p.anneesExperience} ans`,
    `Compétences : ${p.competences.join(", ")}`,
    `Langues : ${p.langues.join(", ")}`,
    `Résumé : ${p.resume}`,
    "Expériences :",
    ...p.experiences.map((e) => `- ${e.poste} chez ${e.entreprise} (${e.periode}) : ${e.points.join(" ; ")}`),
    `Formations : ${p.formations.join(" ; ")}`,
  ].join("\n");
}

interface ScoreResult {
  resultats: (Match & { id: string })[];
}

/** Note un lot d'offres (0–100) par rapport au profil. */
export async function scoreOffers(settings: Settings, profile: Profile, offers: Offer[]) {
  const listing = offers
    .map(
      (o) =>
        `<offre id="${o.id}">\nPoste : ${o.title}\nEntreprise : ${o.company}\nLieu : ${o.location}\n` +
        `${o.contract ? `Contrat : ${o.contract}\n` : ""}Description : ${clip(o.description, 2500)}\n</offre>`,
    )
    .join("\n\n");
  const res = await completeJson<ScoreResult>(settings, {
    schemaName: "notes",
    effort: "low",
    schema: obj({
      resultats: {
        type: "array",
        items: obj({ id: str, score: { type: "number" }, resume: str, pointsForts: strArr, lacunes: strArr }),
      },
    }),
    system:
      "Tu es un recruteur technique exigeant. Tu évalues l'adéquation entre un candidat et des offres d'emploi. " +
      "Barème sur 100 : compétences (50 %), niveau d'expérience (30 %), secteur et type de poste (20 %). Sois honnête et nuancé : une offre hors sujet doit avoir une note basse.",
    user:
      `<profil>\n${profileBrief(profile)}\n</profil>\n\n${listing}\n\n` +
      "Pour CHAQUE offre (même id), donne : score (entier 0–100), resume (une phrase), pointsForts (2–4 éléments du CV qui collent à l'offre), lacunes (0–3 manques réels).",
  });
  return res.resultats;
}

export function writeLetter(settings: Settings, profile: Profile, cvText: string, offer: Offer, instruction?: string) {
  return completeJson<Omit<Letter, "generatedAt">>(settings, {
    schemaName: "lettre",
    effort: "high",
    schema: obj({
      objet: str,
      salutation: str,
      paragraphes: { type: "array", items: obj({ texte: str, source: str }) },
      formule: str,
    }),
    system:
      "Tu rédiges des lettres de motivation françaises remarquables, précises et sans clichés (« dynamique », « passionné », « force de proposition » sont interdits). " +
      `Chaque paragraphe relie un fait du CV à un besoin précis de l'offre ou de l'entreprise. ${HONESTY}`,
    user:
      `<cv>\n${clip(cvText, 20000)}\n</cv>\n\n<profil>\n${profileBrief(profile)}\n</profil>\n\n` +
      `<offre>\nPoste : ${offer.title}\nEntreprise : ${offer.company}\nLieu : ${offer.location}\n` +
      `Description : ${clip(offer.description, 8000)}\n` +
      `${offer.companyDescription ? `À propos de l'entreprise : ${clip(offer.companyDescription, 2000)}\n` : ""}</offre>\n\n` +
      "Rédige la lettre : objet (« Candidature au poste de … »), salutation (« Madame, Monsieur, » sauf si un nom de recruteur figure dans l'offre), " +
      "3 à 5 paragraphes (accroche spécifique à l'entreprise, preuves tirées du CV, valeur apportée au poste, proposition d'entretien), formule de politesse complète. " +
      "Pour chaque paragraphe, « source » est une note de marge très courte (max 12 mots) qui indique d'où vient l'argument, par ex. « CV : 4 ans chez Doctolib · Offre : squad paiement ». " +
      "Environ 250 à 350 mots au total. N'inclus ni coordonnées, ni date, ni signature dans les paragraphes." +
      (instruction ? `\n\nConsigne supplémentaire de l'utilisateur : ${instruction}` : ""),
  });
}

export function prepareInterview(settings: Settings, profile: Profile, cvText: string, offer: Offer) {
  return completeJson<Omit<Interview, "generatedAt">>(settings, {
    schemaName: "entretien",
    effort: "medium",
    schema: obj({
      questions: {
        type: "array",
        items: obj({ categorie: str, question: str, intention: str, reponse: str, appui: str }),
      },
    }),
    system:
      "Tu es un coach d'entretien d'embauche. Tu prépares un candidat aux questions qu'un recruteur de cette entreprise posera vraisemblablement. " +
      `Les réponses sont à la première personne, orales, concrètes, structurées (méthode STAR quand c'est pertinent). ${HONESTY}`,
    user:
      `<cv>\n${clip(cvText, 20000)}\n</cv>\n\n<profil>\n${profileBrief(profile)}\n</profil>\n\n` +
      `<offre>\nPoste : ${offer.title}\nEntreprise : ${offer.company}\n` +
      `${offer.match?.lacunes.length ? `Lacunes repérées face à l'offre : ${offer.match.lacunes.join(" ; ")}\n` : ""}` +
      `Description : ${clip(offer.description, 8000)}\n</offre>\n\n` +
      "Prépare 8 à 10 questions probables, réparties dans les catégories : « Parcours », « Motivation », « Technique / métier », « Mise en situation », « Points sensibles » (lacunes ou trous du CV face à l'offre), « Questions à poser au recruteur ». " +
      "Pour chacune : categorie, question, intention (ce que le recruteur cherche à vérifier, une phrase), reponse (80 à 150 mots, ou pour la dernière catégorie la question que le candidat posera et pourquoi), appui (l'élément précis du CV utilisé, max 12 mots).",
  });
}
