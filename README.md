# CV Matcher

De votre CV PDF à une candidature prête : offres réelles (Indeed, Welcome to the Jungle et LinkedIn via Apify), note /20, lettre de motivation adaptée à l'entreprise, lien direct pour postuler, préparation d'entretien.

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
```

Build de production servi en local (le proxy fonctionne aussi) :

```bash
npm run build && npm run preview   # http://localhost:4173
```

## Ce dont vous avez besoin (page Réglages)

- **Une clé d'IA**, au choix : Anthropic (Claude, par défaut `claude-opus-5-5`), OpenAI, Google Gemini ou Mistral. Le bouton « Tester la clé » liste les modèles de votre compte.
- **Un token Apify** : https://console.apify.com/settings/integrations

Les clés restent dans le navigateur (localStorage, ou session seulement si vous décochez « Se souvenir »). Le serveur Vite sert de proxy local vers les API (`/api/anthropic`, `/api/openai`, `/api/gemini`, `/api/mistral`, `/api/apify`) pour éviter les blocages CORS : les clés ne passent que par votre machine puis vont au fournisseur.

## Pages

| Route | Rôle |
|---|---|
| `/` | Accueil, avancement, meilleures offres |
| `/reglages` | Fournisseur d'IA, modèle, clés, token Apify, plafond de dépense |
| `/cv` | Dépôt du PDF (lu dans le navigateur avec pdf.js), profil extrait et modifiable, critères de recherche |
| `/offres` | Offres classées par note, filtres par source et note |
| `/offres/:id` | Dossier : bouton Postuler, lettre (sources en marge, copier / .txt / imprimer-PDF, réécriture avec consigne), questions d'entretien et réponses, analyse, annonce |

## Actors Apify

- Indeed : [`valig/indeed-jobs-scraper`](https://apify.com/valig/indeed-jobs-scraper)
- Welcome to the Jungle : [`clearpath/welcome-to-the-jungle-jobs-api`](https://apify.com/clearpath/welcome-to-the-jungle-jobs-api)
- LinkedIn : [`valig/linkedin-jobs-scraper`](https://apify.com/valig/linkedin-jobs-scraper)

Appel via `run-sync-get-dataset-items`, avec `maxTotalChargeUsd` réglable par recherche.

## Code

- `src/lib/providers.ts` : appels IA multi-fournisseurs (SDK officiel `@anthropic-ai/sdk` pour Claude, avec sorties structurées et repli `fallbacks: "default"` ; REST pour les autres).
- `src/lib/apify.ts` : appels Apify et normalisation des offres.
- `src/lib/prompts.ts` : analyse du CV, notation, lettre, entretien.
- `src/state/AppState.tsx` : état global et persistance.
- Design : `DESIGN.md`, `PRODUCT.md`.
