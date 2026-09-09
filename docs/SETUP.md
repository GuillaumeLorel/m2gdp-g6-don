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
| Authentication (email) | ✅ | *Email link (passwordless)* actif |
| Firestore | ✅ | région `eur3` |
| Realtime Database | ✅ | `europe-west1` |
| Hosting — landing | ✅ déployé | https://projet-bon-debarras.web.app |
| Hosting — app | ✅ déployé | https://projet-bon-debarras-app.web.app |
| Lien magique (passwordless) | ✅ | vérifié par envoi réel le 09/09/2026 |
| App web enregistrée | ✅ | `m2gdp-g6-don` |
| Service account key | ✅ | JSON à la racine, **git-ignoré** — à déplacer hors du dépôt |

Config client (publique) : [`public/src/lib/firebase.js`](../public/src/lib/firebase.js).
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

## 4. Application PWA — `public/`

Vite + React 19 + Tailwind 4 + shadcn/ui, en **JavaScript** (pas TypeScript :
TS 7 est une réécriture majeure et l'outillage n'a pas fini de suivre).

```bash
cd public
npm install
npm run dev      # serveur de dev, rechargement à chaud
npm run build    # produit public/dist
```

Particularités liées au fait que l'app vit dans `public/`, pour respecter la
convention du cours (`/public` = App Frontend) :

- `publicDir` est renommé en **`static/`** — sinon Vite chercherait `public/public`.
  Tout ce qui doit être servi tel quel (manifest, service worker, icônes) va là.
- Le build sort dans **`public/dist`**, qui est la cible Hosting `app`.
  `dist/` est git-ignoré : on ne versionne pas le build.

Côté PWA : `manifest.webmanifest`, icônes 192 et 512 px, et un service worker
maison sans dépendance. Sa stratégie est **réseau d'abord** sur la navigation,
et il ne met **jamais** `/api/` en cache — une enchère périmée de quelques
secondes serait fausse.

La charte graphique n'est pas encore posée : les jetons de couleur sont neutres
dans `src/index.css`. Quand les maquettes UX arriveront, il suffira de remplacer
ces variables, sans toucher aux composants.

## 5. Déploiement

- **Vitrine** : `firebase deploy --only hosting:landing`
- **App** : `cd public && npm run build` **puis**
  `firebase deploy --only hosting:app` — sans build, on republie l'ancien `dist/`
- **Worker backend** : `cd workers && wrangler deploy`

Le déploiement Firebase fonctionne **sans `firebase login`** en pointant la clé de
service, ce qui est pratique en CI ou depuis un poste non authentifié :

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/projet-bon-debarras-firebase-adminsdk-*.json"
firebase deploy --only hosting --project projet-bon-debarras --non-interactive
```

## 6. Agentic Coding — Skills et MCP ✅

Tout est versionné : un coéquipier qui clone le dépôt récupère la même
configuration, sans réglage manuel.

### Serveurs MCP — `.mcp.json`

| Serveur | Rôle | Vérifié |
|---------|------|---------|
| `playwright` | pilotage d'un vrai navigateur : tests E2E, captures, débogage | ✅ 24 outils |
| `shadcn` | recherche et installation de composants UI depuis le registre | ✅ 7 outils |

Les versions sont **épinglées** (`@playwright/mcp@0.0.80`, `shadcn@4.21.0`) pour
que l'équipe travaille sur la même base. Au premier lancement, le client IA
demande d'approuver les serveurs déclarés par le projet : c'est normal.

Playwright couvre l'exigence « Tests automatisés conformes et valides » du
barème ; shadcn alimente la partie Ergonomie (composants cohérents, mobile-first).

### Skills projet — `.claude/skills/`

| Skill | Quand elle sert |
|-------|-----------------|
| `deployer` | mettre en ligne le front, la vitrine ou le worker |
| `verif-infra` | vérifier que toute la stack répond, avant une démo |

Elles capturent les pièges déjà rencontrés (le `--remote` de wrangler, les
booléens absents de l'API Auth, les domaines autorisés) pour ne pas les
redécouvrir en J4.

## 7. GitHub

- ✅ `@quangfr` ajouté comme collaborateur.
- ⏳ Organiser les spécifications dans des tickets (EPIC / User Story / tâche).

## 8. Vérification rapide

Healthcheck du worker :
```bash
curl https://m2gdp-g6-don.guillaume-lorel.workers.dev/api/health
```
Réponse attendue : `{"status":"ok","service":"m2gdp-g6-don","ts":...}`.
Vérifié le 09/09/2026 : HTTP 200 en ~0,7 s.
