# m2gdp-g6-don — Enchères caritatives (DON)

Projet Gestion de Projet M2CIM 2026/2027 — Groupe 6.

Marketplace d'enchères caritatives : des vendeurs cèdent des objets qu'ils
n'utilisent plus, les acheteurs enchérissent, la meilleure offre remporte la
mise, et l'argent est reversé à des causes caritatives.

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
