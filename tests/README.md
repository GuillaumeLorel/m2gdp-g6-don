# /tests — Tests automatisés Playwright

Tests E2E écrits d'après les **critères d'acceptation** des User Stories : un
fichier par US, un test par scénario Gherkin, avec le titre du scénario.

## Lancer

Prérequis : le Worker en local (`cd workers && npx wrangler dev --port 8787`,
voir `docs/SETUP.md`) et la clé secrète Supabase, dans `.env.supabase` à la
racine du dépôt (ou la variable `SUPABASE_SECRET_KEY`).

```bash
cd tests
npm install
npx playwright install chromium   # une fois
npm test                          # lance aussi le front sur le port 5180
npm run rapport                   # rapport HTML, captures des échecs
```

`DONEO_URL` et `DONEO_API` permettent de viser un autre front ou un autre Worker.

## Comment les tests se connectent

Le lien magique passe par une boîte mail : inutilisable dans un test. Avec la
clé secrète, les tests demandent à Supabase un lien sans l'envoyer, l'échangent
contre une **session**, et le front l'adopte par un crochet présent **en
développement seulement** (`window.__doneoTest`, absent du build de production).

Ils utilisent deux profils de démonstration (`specs/donnees/demo`) ; leur compte
de connexion est créé avant les tests (`global-setup.js`). Supabase limite les
connexions à 30 toutes les 5 minutes : chaque processus de test ouvre une seule
session par profil et la réutilise.

Les cas d'erreur (service en panne, liste vide) sont simulés en interceptant les
appels réseau, sans toucher aux données.

| Fichier | US |
| --- | --- |
| `e2e/accueil.spec.js` | US-4 — Accueil, menu du bas, derniers objets (#32) |
| `e2e/illustration-par-defaut.spec.js` | US-12 — Illustration des annonces sans photo (#40) |
| `e2e/fiche-annonce.spec.js` | US-9 — Fiche d’annonce, adresse jamais exposée (#37) |
| `e2e/recherche.spec.js` | US-13 — Recherche par mot-clé en liste (#41) |
| `e2e/filtres.spec.js` | US-14 — Filtres catégorie, état, participation (#42) |
| `e2e/tri.spec.js` | US-15 — Tri par date, participation ou créneau (#43) |
| `e2e/vue-carte.spec.js` | US-16 — Bascule liste / carte (#44) |
| `e2e/regressions-revue.spec.js` | Non-régression des défauts relevés par la revue de code du J4 |
| `e2e/ergonomie-mobile.spec.js` | En-têtes collants, pas de saut au changement de tri, retour toujours accessible |
| `e2e/grand-ecran.spec.js` | Affichage grand écran (1440 px) : navigation, grille, liste + carte, fiche |
| `e2e/tablette.spec.js` | Affichage tablette (820 px) : deux colonnes, menu du bas |
