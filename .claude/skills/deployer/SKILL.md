---
name: deployer
description: Déploie le projet Donéo — le front et la vitrine sur Vercel, le backend sur Cloudflare Workers. À utiliser dès qu'une modification doit être visible en ligne, avant une démo, ou quand on demande de « mettre en ligne » / « publier » / « déployer » l'application.
---

# Déployer Donéo

Deux cibles indépendantes. Ne déployer que celle qui a changé.

## Avant tout : partir de `main` à jour

```bash
git checkout main && git pull
git status   # doit être propre
```

**Ne jamais déployer depuis une autre branche.** `vercel deploy` et
`wrangler deploy` publient le code local : déployer depuis une branche
de ticket ou depuis `develop` efface du site en ligne le travail des autres.
Si ce qui doit partir n'est pas encore dans `main`, le fusionner d'abord
(`develop` → `main`, par PR), et prévenir l'équipe.

## Front et vitrine (Vercel)

Deux projets Vercel, sur le compte de Guillaume (équipe
`guillaumelorels-projects`). Chaque dossier est relié à son projet par un
`.vercel/` git-ignoré ; sur un poste neuf : `npx vercel link --project <nom>`.

| Projet | Dossier | Build | URL |
|-------|---------|-------|-----|
| `doneo` | `public/` | par Vercel (`public/vercel.json`) | https://doneo-app.vercel.app |
| `doneo-vitrine` | `landing/` | aucun, HTML statique | https://doneo-vitrine.vercel.app |

```bash
cd public && npx vercel deploy --prod --yes   # l'app
cd landing && npx vercel deploy --prod --yes  # la vitrine
```

**Déploiement « Blocked »** : Vercel (forfait gratuit) refuse de déployer un
commit dont l'auteur n'est pas reconnu comme titulaire du compte. C'est le cas
des commits de fusion créés par GitHub, signés `…@users.noreply.github.com`.
Contournement : déployer le contenu de `main` sans ses métadonnées Git.

```bash
git checkout main && git pull
D=$(mktemp -d) && git archive main public landing | tar -x -C "$D"
cp -r public/.vercel "$D/public/" && cp -r landing/.vercel "$D/landing/"
(cd "$D/public" && npx vercel deploy --prod --yes)
(cd "$D/landing" && npx vercel deploy --prod --yes)
```

Vercel construit l'app lui-même : inutile de builder avant. Si le Worker a
changé aussi, le déployer **d'abord** : le front dépend de ses routes.

Une fois l'application Vercel installée sur le dépôt GitHub (par Lucas),
chaque mise à jour de `main` se déploie seule : ne plus le faire à la main.

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
curl -s https://doneo-api.guillaume-lorel.workers.dev/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://doneo-app.vercel.app/recherche
```

Voir la skill `verif-infra` pour une vérification complète de la stack.

## Points d'attention

- **Les secrets du Worker ne sont pas dans le dépôt.** Un `wrangler deploy` les
  conserve, mais recréer le Worker de zéro les perd : il faut alors reposer
  `SUPABASE_SECRET_KEY` (voir `docs/SETUP.md` § 3).
- **Ne jamais committer la clé secrète Supabase.** Elle vit dans
  `.env.supabase` et `workers/.dev.vars`, tous deux git-ignorés.
- Une nouvelle adresse de front doit être ajoutée aux *Redirect URLs* de
  Supabase Auth (sinon le lien magique ramène sur la *Site URL*) **et** à
  `ALLOWED_ORIGIN` dans `workers/wrangler.toml` (sinon le Worker refuse ses
  appels).
