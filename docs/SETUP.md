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

## 3. Cloudflare — ⏳ À FAIRE (login navigateur requis)

Tout se fait depuis `workers/`. Le `wrangler login` ouvre le navigateur : il doit
être lancé par un humain.

```bash
cd workers
wrangler login                                  # 1. ouvre le navigateur
wrangler d1 create m2gdp-g6-don-sessions        # 2. → note le database_id
wrangler r2 bucket create m2gdp-g6-don-fichiers # 3.
```

4. Reporter le `database_id` renvoyé à l'étape 2 dans
   [`workers/wrangler.toml`](../workers/wrangler.toml) (ligne `database_id`).

5. Enregistrer les secrets (jamais en clair dans le repo) :
   ```bash
   # colle le CONTENU du JSON de service account quand il le demande
   wrangler secret put FIREBASE_SERVICE_ACCOUNT
   # AIzaSyD8ZbZ-Sf7Rfej1HGYm4AOTHoUi9D6kFj8
   wrangler secret put FIREBASE_API_KEY
   ```

`ALLOWED_ORIGIN` est déjà réglé sur `https://projet-bon-debarras-app.web.app`
dans `wrangler.toml`.

## 4. Déploiement

- **Front / vitrine** : `firebase deploy --only hosting`
- **Worker backend** : `cd workers && wrangler deploy`

## 5. GitHub

- Ajouter `@quangfr` comme collaborateur (Settings → Collaborators).
- Organiser les spécifications dans des tickets (EPIC / User Story / tâche).

## Vérification rapide

Après déploiement du worker, tester le healthcheck :
```bash
curl https://m2gdp-g6-don.<ton-sous-domaine>.workers.dev/api/health
```
Réponse attendue : `{"status":"ok",...}`.
