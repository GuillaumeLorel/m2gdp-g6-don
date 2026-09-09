# Setup — m2gdp-g6-don

Ordre d'installation et de configuration (Prérequis Agentic Coding J2).

## 1. Outils locaux

- **IDE avec IA** (au choix) : Google Antigravity, VS Code + Copilot, ou
  OpenCode Desktop.
- **Node.js** (LTS) + npm.
- **Firebase CLI** : `npm install -g firebase-tools`
- **Wrangler** (Cloudflare) : `npm install -g wrangler`
- **Playwright** : `npm init playwright@latest` (dans `/tests`)

## 2. Firebase — ✅ FAIT

Projet : **`projet-bon-debarras`** (numéro `134185101825`).

| Élément | État | Détail |
|---------|------|--------|
| Authentication (email) | ✅ | Vérifier que *Email link (passwordless)* est bien coché |
| Firestore | ✅ | région `eur3` |
| Realtime Database | ✅ | `europe-west1` |
| Hosting — landing | ✅ | https://projet-bon-debarras.web.app |
| Hosting — app | ✅ | https://projet-bon-debarras-app.web.app |
| App web enregistrée | ✅ | `m2gdp-g6-don` |
| Service account key | ✅ | JSON à la racine, **git-ignoré** — à déplacer hors du dépôt |

Config client (publique) : [`public/firebase-config.js`](../public/firebase-config.js).
Targets Hosting : déjà dans [`.firebaserc`](../.firebaserc). Si un poste neuf ne
les connaît pas :
```bash
firebase target:apply hosting landing projet-bon-debarras
firebase target:apply hosting app projet-bon-debarras-app
```

## 3. Cloudflare — ✅ FAIT

Compte : `af6e99118eacb7dae1f71bab594ad0ed`.
Worker en ligne : **https://m2gdp-g6-don.guillaume-lorel.workers.dev**

| Ressource | État |
|-----------|------|
| `wrangler login` | ✅ |
| D1 `m2gdp-g6-don-sessions` | ✅ région WEUR, `database_id` dans `wrangler.toml` |
| R2 `m2gdp-g6-don-fichiers` | ✅ créé le 09/09/2026 |
| Worker déployé | ✅ version `85f953d9` |
| Secrets | ✅ `FIREBASE_SERVICE_ACCOUNT` + `FIREBASE_API_KEY` |

Pour reposer un secret (rotation de clé, nouveau compte), depuis `workers/` — en
pipant le contenu plutôt qu'en le collant, pour qu'il ne reste pas dans
l'historique du terminal :

```bash
cat ../projet-bon-debarras-firebase-adminsdk-fbsvc-*.json \
  | wrangler secret put FIREBASE_SERVICE_ACCOUNT
printf '%s' "<api-key>" | wrangler secret put FIREBASE_API_KEY
```

Les secrets ne sont jamais relisibles ensuite : `wrangler secret list` ne renvoie
que leurs noms.

Notes :
- **L'ordre compte** : `wrangler secret put` sur un Worker qui n'existe pas encore
  déclenche une invite interactive. Déployer *avant* de poser les secrets.
- Le `binding` suggéré par `wrangler d1 create` est ignoré : on garde
  `DB_SESSIONS`, le nom utilisé dans le code du Worker.
- R2 demande une activation préalable du service sur le compte Cloudflare
  (erreur `code: 10042` sinon), moyen de paiement requis même en palier gratuit.
- `ALLOWED_ORIGIN` est défini dans `wrangler.toml` mais **pas encore lu par le
  code** : `src/index.js` renvoie toujours `Access-Control-Allow-Origin: *`.

## 4. Déploiement

- **Front / vitrine** : `firebase deploy --only hosting`
- **Worker backend** : `cd workers && wrangler deploy`

## 5. GitHub

- Ajouter `@quangfr` comme collaborateur (Settings → Collaborators).
- Organiser les spécifications dans des tickets (EPIC / User Story / tâche).

## Vérification rapide

Healthcheck du worker :
```bash
curl https://m2gdp-g6-don.guillaume-lorel.workers.dev/api/health
```
Réponse attendue : `{"status":"ok","service":"m2gdp-g6-don","ts":...}`.
Vérifié le 09/09/2026 : HTTP 200 en ~0,7 s.
