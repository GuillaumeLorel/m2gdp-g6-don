---
name: deployer
description: Déploie le projet DON — le front et la vitrine sur Firebase Hosting, le backend sur Cloudflare Workers. À utiliser dès qu'une modification doit être visible en ligne, avant une démo, ou quand on demande de « mettre en ligne » / « publier » / « déployer » l'application.
---

# Déployer DON

Deux cibles indépendantes. Ne déployer que celle qui a changé.

## Front et vitrine (Firebase Hosting)

Depuis la racine du dépôt :

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/projet-bon-debarras-firebase-adminsdk-fbsvc-75eab3a19c.json"
firebase deploy --only hosting --project projet-bon-debarras --non-interactive
```

La clé de service évite le `firebase login` interactif — utile en CI et depuis un
poste non authentifié. Deux cibles sont définies dans `.firebaserc` :

| Cible | Dossier | URL |
|-------|---------|-----|
| `landing` | `landing/` | https://projet-bon-debarras.web.app |
| `app` | `public/` | https://projet-bon-debarras-app.web.app |

Pour n'en déployer qu'une : `--only hosting:landing` ou `--only hosting:app`.

## Backend (Cloudflare Workers)

Depuis `workers/` :

```bash
wrangler deploy
```

Valider la configuration sans rien publier :

```bash
wrangler deploy --dry-run --outdir /tmp/dry
```

Le dry-run affiche les bindings résolus (`DB_SESSIONS`, `BUCKET_FICHIERS`,
`ALLOWED_ORIGIN`) : c'est le moyen le plus rapide de détecter un `wrangler.toml`
cassé avant de déployer.

## Après déploiement

Toujours confirmer que le déploiement a pris, plutôt que de se fier au message
de succès :

```bash
curl -s https://m2gdp-g6-don.guillaume-lorel.workers.dev/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://projet-bon-debarras-app.web.app
```

Voir la skill `verif-infra` pour une vérification complète de la stack.

## Points d'attention

- **Les secrets du Worker ne sont pas dans le dépôt.** Un `wrangler deploy` les
  conserve, mais recréer le Worker de zéro les perd : il faut alors reposer
  `FIREBASE_SERVICE_ACCOUNT` et `FIREBASE_API_KEY`.
- **Ne jamais committer la clé de service.** Elle est ignorée via
  `*-adminsdk-*.json` dans `.gitignore`.
- Un nouveau site Hosting doit être ajouté aux domaines autorisés de Firebase
  Auth, sinon les liens magiques qui pointent dessus sont rejetés.
