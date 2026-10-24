# Setup — Donéo

Installer le projet, obtenir les accès, travailler à plusieurs et déployer.

## 0. Arriver sur le projet

### Ce qui marche sans aucun accès

Le front se lance tout de suite, sans secret : la configuration Firebase côté
client est publique, et le front appelle le Worker déjà en ligne.

```bash
git clone https://github.com/Lucas-ui/m2gdp-g6-don.git
cd m2gdp-g6-don && git checkout develop
cd public && npm install && npm run dev
```

La connexion par lien magique fonctionne aussi en local : `localhost` fait
partie des domaines autorisés par Firebase.

> ⚠️ Il n'y a **qu'un seul environnement**. En local, on lit et on écrit dans
> la **vraie** base Firestore, celle du site en ligne. Ne pas y créer de
> données de test qu'on ne nettoie pas.

### Les accès à demander

| Accès | Pour quoi | Qui le donne |
| --- | --- | --- |
| **GitHub**, collaborateur du dépôt | Pousser des branches, ouvrir des PR | Lucas, propriétaire du dépôt |
| **Cloudflare**, membre du compte | Déployer le Worker | Guillaume — Dashboard › Manage Account › Members |

Une fois l'invitation acceptée : `wrangler login`.

Le front et la vitrine sont hébergés sur **Vercel**, sur le compte de Guillaume
(forfait gratuit, qui n'accepte pas de second membre). Pour les mettre en ligne
sans accès Vercel : fusionner dans `main`, puis demander à Guillaume — ou,
une fois l'application Vercel installée sur le dépôt GitHub, laisser Vercel
déployer seul à chaque mise à jour de `main` (voir § 6).

La **clé de service Firebase** (JSON) n'est utile que pour lancer le Worker en
local. Elle se transmet en main propre, jamais par GitHub ni par une
messagerie de groupe.

### Lire avant de coder

- [`AGENTS.md`](../AGENTS.md) — règles métier et conventions, valables aussi
  pour Copilot et les autres IA.
- [`specs/data-model.md`](../specs/data-model.md) et
  [`specs/openapi.yaml`](../specs/openapi.yaml) — le modèle et le contrat d'API.
- [`.claude/skills/`](../.claude/skills/) — des procédures en Markdown, lisibles
  sans Claude (voir § 6).

## 1. Outils locaux

- **Node.js** (LTS) + npm.
- **Vercel CLI** : `npx vercel` (pas d'installation nécessaire)
- **Wrangler** (Cloudflare) : `npm install -g wrangler`
- **Playwright** : `npm init playwright@latest` (dans `/tests`)
- Un IDE, avec ou sans IA.

## 2. Firebase

Projet : **`doneo-3561b`** (numéro `134185101825`), sur le forfait **Blaze**
(l'envoi d'e-mails de connexion dépassait le quota du forfait gratuit).

| Élément | Détail |
| --- | --- |
| Authentication | *Email link (passwordless)* |
| Firestore | région `eur3` |
| Realtime Database | `europe-west1` |
| Hosting | **N'est plus utilisé** : le front est passé sur Vercel (§ 6). `doneo.web.app` reste en ligne pendant la transition |
| Clé de service | JSON à la racine, **git-ignoré** |

Config client (publique) : [`public/src/lib/firebase.js`](../public/src/lib/firebase.js).

**Domaines autorisés** (Authentication › Paramètres) : le lien magique ne
ramène que vers eux. `localhost` et `doneo-app.vercel.app` y figurent ; les
aperçus de branche Vercel n'y sont pas — Firebase n'accepte pas de joker —,
donc on ne peut pas s'y connecter.

## 3. Cloudflare

Compte : `af6e99118eacb7dae1f71bab594ad0ed`.
Worker en ligne : **https://doneo-api.guillaume-lorel.workers.dev**

| Ressource | Détail |
| --- | --- |
| D1 `doneo-sessions` | région WEUR, `database_id` dans `wrangler.toml` |
| R2 `doneo-fichiers` | fichiers et photos |
| Secrets | `FIREBASE_SERVICE_ACCOUNT` + `FIREBASE_API_KEY` |

Pour reposer un secret (rotation de clé, nouveau compte), depuis `workers/` — en
pipant le contenu plutôt qu'en le collant, pour qu'il ne reste pas dans
l'historique du terminal :

```bash
cat ../doneo-3561b-firebase-adminsdk-fbsvc-*.json \
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
- `ALLOWED_ORIGIN` (`wrangler.toml`) liste les adresses du front autorisées à
  appeler le Worker, séparées par des virgules ; `*` remplace un segment
  d'adresse, pour les aperçus Vercel. `localhost` est toujours autorisé.

## 4. Application PWA — `public/`

Vite + React 19 + **Tailwind CSS v4 + shadcn/ui**, en **JavaScript** (pas
TypeScript : TS 7 est une réécriture majeure et l'outillage n'a pas fini de
suivre).

```bash
cd public
npm install
npm run dev      # serveur de dev, rechargement à chaud
npm run build    # produit public/dist
```

### Développer avec le Worker en local

Pour tester une route du Worker avant qu'elle soit déployée :

1. Créer `workers/.dev.vars` (git-ignoré) avec les deux secrets du Worker, la
   clé de service sur une seule ligne et entre apostrophes :
   ```
   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   FIREBASE_API_KEY='AIza...'
   ```
2. Lancer le Worker : `cd workers && npx wrangler dev --port 8787`.
3. Créer `public/.env.development.local` (git-ignoré) :
   `VITE_API_BASE=http://localhost:8787`, puis relancer `npm run dev`.

Sans ce fichier, le front local appelle le Worker **en ligne**. Le Worker local
lit et écrit la **vraie** base Firestore.

### Tester sur un téléphone (même Wi-Fi)

Le serveur du front relaie `/api` vers le Worker local (`server.proxy` dans
`vite.config.js`) : le téléphone n'a besoin de joindre que lui. Le pare-feu
Windows bloque en effet les connexions entrantes vers le Worker local.

1. Trouver l'adresse du PC sur le Wi-Fi (`ipconfig`), par exemple
   `192.168.1.18`.
2. Lancer le Worker comme d'habitude, puis le front ouvert sur le réseau, en
   lui faisant viser sa propre adresse :
   ```bash
   VITE_API_BASE=http://192.168.1.18:5180 npx vite --host 0.0.0.0 --port 5180
   ```
3. Pour se connecter par lien magique depuis le téléphone, ajouter
   `192.168.1.18` aux **domaines autorisés** de Firebase Auth (Console Firebase
   › Authentication › Paramètres). L'adresse change d'un réseau à l'autre :
   la retirer une fois les tests finis.
4. Sur le téléphone : `http://192.168.1.18:5180`.

Particularités liées au fait que l'app vit dans `public/`, pour respecter la
convention du cours (`/public` = App Frontend) :

- `publicDir` est renommé en **`static/`** — sinon Vite chercherait `public/public`.
  Tout ce qui doit être servi tel quel (manifest, service worker, icônes,
  illustrations) va là.
- Le build sort dans **`public/dist`**, que Vercel publie (`public/vercel.json`).
  `dist/` est git-ignoré : on ne versionne pas le build.

Côté PWA : `manifest.webmanifest`, icônes 192 et 512 px, et un service worker
maison sans dépendance. Sa stratégie est **réseau d'abord** sur la navigation,
et il ne met **jamais** `/api/` en cache — un objet déjà réservé ne doit pas
continuer à s'afficher comme disponible.

La **charte graphique est en place** : jetons de couleur, typographies et
composants dans `src/index.css` et `src/components/`. Le détail — quel
composant pour quel besoin — est dans
[`.claude/skills/charte-doneo/SKILL.md`](../.claude/skills/charte-doneo/SKILL.md).

## 5. Travailler à plusieurs : branches et déploiement

### Les branches

| Branche | Rôle | Qui y écrit |
| --- | --- | --- |
| `main` | Ce qui est **en ligne**. On ne déploie que d'ici | Uniquement par fusion de `develop` |
| `develop` | Intégration : le travail terminé de chacun | Uniquement par PR depuis une branche de ticket |
| `feat/<n°>-<sujet>` | Un ticket, par exemple `feat/12-fiche-annonce` | Son auteur |

Corrections : `fix/<n°>-<sujet>`. Documentation : `docs/<sujet>`.

### Le cycle d'un ticket

```bash
git checkout develop && git pull
git checkout -b feat/12-fiche-annonce
# ... commits ...
git push -u origin feat/12-fiche-annonce
```

Puis une **pull request vers `develop`**. Pas de relecture obligatoire : chacun
peut fusionner la sienne. La PR sert à voir ce que fait l'autre et à régler
les conflits avant qu'ils n'arrivent dans `develop`.

Garder les branches **courtes** — un ou deux jours. Plus une branche vit,
plus la fusion fait mal. Récupérer `develop` régulièrement :
`git pull origin develop`.

### Mettre en ligne

Quand `develop` est stable, on la fusionne dans `main` (par PR `develop` →
`main`), **puis** on déploie depuis `main` :

```bash
git checkout main && git pull
cd workers && npx wrangler deploy && cd ..   # d'abord le Worker
cd public && npx vercel deploy --prod        # puis le front
```

> ⚠️ **Ne jamais déployer depuis une autre branche que `main` à jour.**
> `vercel deploy` et `wrangler deploy` publient le code local de celui qui lance
> la commande : déployer depuis sa branche efface du site
> en ligne le travail des autres.

Prévenir l'équipe avant un déploiement, pour ne pas déployer à deux.

### Règles

- Jamais de `git push --force` sur `main` ni `develop`.
- Jamais de secret dans un commit (clé de service, `.env`, token Cloudflare).
- Messages de commit en français, préfixés : `feat:`, `fix:`, `docs:`,
  `refactor:`, `chore:`.

## 6. Déploiement — détails

| Quoi | Où | Commande, depuis `main` à jour |
| --- | --- | --- |
| App | https://doneo-app.vercel.app (projet Vercel `doneo`) | `cd public && npx vercel deploy --prod` |
| Vitrine | https://doneo-vitrine.vercel.app (projet Vercel `doneo-vitrine`) | `cd landing && npx vercel deploy --prod` |
| Worker | https://doneo-api.guillaume-lorel.workers.dev | `cd workers && npx wrangler deploy` |

Vercel construit lui-même l'app (`npm run build`, réglages dans
`public/vercel.json`) : inutile de builder avant. Le dossier `.vercel/` créé
par `vercel link` relie le dossier au projet ; il est git-ignoré.

**Hébergement et données** — la demande du 11/10/2026 impose des services
hébergés en France ou dans l'UE. Vercel ne sert que des fichiers statiques
(HTML, JS, images) : aucune donnée personnelle n'y transite, elles passent
toutes par le Worker. La base et l'authentification migrent ensuite vers
Supabase, en région européenne.

**Déploiement automatique** (à activer) : une fois l'application Vercel
installée sur le dépôt GitHub — par Lucas, propriétaire —, Vercel déploie
seul chaque mise à jour de `main` et crée un aperçu pour chaque PR.

Vérifier ensuite que le déploiement a pris :

```bash
curl https://doneo-api.guillaume-lorel.workers.dev/api/health
curl -s -o /dev/null -w "%{http_code}
" https://doneo-app.vercel.app/recherche
```

Réponse attendue : `{"status":"ok","service":"doneo-api","ts":...}`.

## 7. Agentic Coding — skills et MCP

Tout est versionné : un coéquipier qui clone le dépôt récupère la même
configuration.

### Serveurs MCP — `.mcp.json`

| Serveur | Rôle |
| --- | --- |
| `playwright` | Pilotage d'un vrai navigateur : tests E2E, captures, débogage |
| `shadcn` | Recherche et installation de composants UI depuis le registre |

Les versions sont **épinglées** (`@playwright/mcp@0.0.80`, `shadcn@4.21.0`) pour
que l'équipe travaille sur la même base.

### Skills — `.claude/skills/`

Écrites pour Claude Code, mais ce sont de simples fichiers Markdown : sans
Claude, elles se lisent comme des procédures.

| Skill | Quand elle sert |
| --- | --- |
| `deployer` | Mettre en ligne le front, la vitrine ou le Worker |
| `verif-infra` | Vérifier que toute la stack répond, avant une démo |
| `valider-specs` | Valider `openapi.yaml` et les diagrammes de `data-model.md` |
| `charte-doneo` | Créer ou vérifier un écran selon la charte graphique |
| `commiter` | Branches, messages de commit, fichiers à ne jamais ajouter |
