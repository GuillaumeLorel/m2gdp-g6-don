# m2gdp-g6-don — Dons entre particuliers (DON)

Projet Gestion de Projet M2CIM 2026/2027 — Groupe 6.

Plateforme de dons d'objets. Des **donateurs** cèdent gratuitement ce dont ils
n'ont plus l'usage — mobilier, électroménager, matériel scolaire, vêtements.
Des **bénéficiaires**, souvent des jeunes dans le besoin, étudiants qui
s'installent ou personnes en difficulté, en font la demande et viennent les
récupérer en main propre.

**Aucun argent ne circule** : ni prix, ni enchère, ni commission. La plateforme
est un intermédiaire de confiance qui met en relation deux populations dont les
besoins se répondent, avec la proximité géographique pour contrainte principale.

## Structure du dépôt

| Répertoire   | Contenu                                                        |
|--------------|----------------------------------------------------------------|
| `/landing`   | Site vitrine statique (HTML/CSS/img). URL : site.web.app       |
| `/public`    | Application web frontend (PWA). URL : app.site.web.app         |
| `/workers`   | Logique métier backend (Cloudflare Workers)                    |
| `/docs`      | Documentation technique et guides                              |
| `/design`    | Artefacts UX en HTML (charte graphique, maquettes)             |
| `/specs`     | Artefacts PO (specs OpenAPI, diagrammes Mermaid, données JSON) |
| `/tests`     | Tests automatisés Playwright (scripts, résultats)              |
| `agents.md`  | Instructions générales pour l'IA                               |

## Stack technique

- **Frontend** : PWA, framework Material Design (Shadcn), LeafletJS (carte),
  Google Places API (géolocalisation)
- **Backend** : Cloudflare Workers (logique métier)
- **Auth** : Firebase Authentication (lien magique, sans mot de passe)
- **Données** : Firestore (NoSQL) + Firebase Realtime DB (messages)
- **Fichiers** : Cloudflare R2
- **Sessions** : Cloudflare D1 (SQL)
- **Hébergement** : Firebase Hosting

## Démarrage

Voir [`docs/SETUP.md`](docs/SETUP.md) pour l'installation et la configuration.

## Équipe

- PO : _à compléter_
- UX : _à compléter_
- DEV : Guillaume
- Sponsor / Manager : @quangfr
