# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript (Vite), HTML/CSS, plusieurs pages (React Router). Application 100 % côté navigateur, lancée en local (`npm run dev` / `npm run preview`). Choix confirmé par l'utilisateur : « Je voudrais que tu utilises React ».

## Users

Usage personnel : une seule personne francophone qui cherche un emploi en France. Elle dépose son CV en PDF, veut voir rapidement les offres qui lui correspondent, puis préparer une candidature solide pour chacune (lettre, lien pour postuler, préparation d'entretien).

## Product Purpose

Transformer un CV PDF en candidatures prêtes : extraction du profil, recherche d'offres réelles (Indeed et Welcome to the Jungle via Apify), score d'adéquation par offre, lettre de motivation adaptée à l'entreprise, lien direct pour postuler, et réponses préparées aux questions d'entretien probables, toutes fondées sur le CV. Succès : passer du PDF à une candidature envoyable en quelques minutes.

## Positioning

Tout part du CV réel de l'utilisateur et de vraies offres scrapées ; chaque lettre et chaque réponse d'entretien cite des éléments vérifiables du CV et de l'offre, sans inventer d'expérience.

## Operating Context

- L'utilisateur fournit lui-même ses identifiants : une clé API d'un fournisseur d'IA majeur (Anthropic, OpenAI, Google Gemini, Mistral) et un token Apify. Ils restent dans son navigateur.
- Sources d'offres : Indeed (actor `valig/indeed-jobs-scraper`) et Welcome to the Jungle (actor `clearpath/welcome-to-the-jungle-jobs-api`).
- Parcours : Réglages → CV → Recherche → Offres → Dossier d'une offre (lettre, postuler, entretien).

## Capabilities and Constraints

- Lecture du PDF dans le navigateur (pdf.js), pas de serveur applicatif.
- Les appels IA et Apify coûtent de l'argent à l'utilisateur : afficher clairement ce qui déclenche un appel.
- Les clés ne quittent pas la machine sauf vers le fournisseur concerné (via le proxy local de Vite).
- Undecided : export PDF de la lettre (impression navigateur pour l'instant), suivi des candidatures envoyées.

## Evidence on Hand

Aucun témoignage, logo ou chiffre réel. Ne rien inventer de commercial.

## Product Principles

1. Le CV est la source de vérité : jamais d'expérience inventée.
2. Chaque action coûteuse est explicite et réversible.
3. Une offre = un dossier complet, prêt à envoyer.
4. Les secrets de l'utilisateur restent chez lui.
