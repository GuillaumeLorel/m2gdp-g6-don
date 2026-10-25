---
name: verif-infra
description: Vérifie de bout en bout que toute la stack serverless du projet Donéo répond — worker Cloudflare, D1, base, stockage et connexion Supabase, et les deux sites Vercel. À utiliser avant une démo (J3, J4, J5), après un déploiement, ou quand quelque chose « ne marche plus » sans qu'on sache quel service est en cause.
---

# Vérifier l'infrastructure Donéo

Chaque test écrit **puis nettoie** ses données. Ne jamais laisser de table
`smoke_test` ou d'objet de test derrière soi.

## 1. Worker et sites (aucune authentification requise)

```bash
W="https://doneo-api.guillaume-lorel.workers.dev"
curl -s -w " -> %{http_code}\n" $W/api/health          # attendu : 200 + status ok
curl -s -o /dev/null -w "404 attendu -> %{http_code}\n" $W/api/route-bidon
curl -s -o /dev/null -w "vitrine -> %{http_code}\n" https://doneo-vitrine.vercel.app
curl -s -o /dev/null -w "app     -> %{http_code}\n" https://doneo-app.vercel.app/recherche
```

Un **404 sur l'app** signifie presque toujours que le projet Vercel n'a pas
été redéployé, ou qu'il manque `public/vercel.json`, pas que le site est cassé.

## 2. Cloudflare D1

Depuis `workers/`, avec `wrangler` authentifié. Le drapeau `--remote` est
indispensable : sans lui, wrangler tape une base locale et le test ne prouve
rien.

```bash
wrangler d1 execute doneo-sessions --remote --yes \
  --command "CREATE TABLE IF NOT EXISTS smoke_test (id INTEGER PRIMARY KEY, note TEXT); \
             INSERT INTO smoke_test (note) VALUES ('verif'); SELECT * FROM smoke_test;"
wrangler d1 execute doneo-sessions --remote --yes --command "DROP TABLE smoke_test;"
```

Les photos ne sont plus sur R2 (bucket `doneo-fichiers`, inutilisé) mais dans
Supabase Storage : voir § 3.

Vérifier aussi que les secrets sont toujours en place — ils disparaissent si le
Worker est recréé :

```bash
wrangler secret list   # attendu : SUPABASE_SECRET_KEY
```

## 3. Supabase (base de données)

La clé publique doit être **refusée** (RLS sans règle), la clé secrète
acceptée (lue dans `.env.supabase`) :

```bash
U=https://ocapkeuidpuhcsnerkse.supabase.co/rest/v1
curl -s -o /dev/null -w "publique -> %{http_code} (401 attendu)
" -H "apikey: sb_publishable_mmvcB0QIyEEAJp911GOcUw_xyanIiwK" "$U/annonces?select=id"
curl -s -o /dev/null -w "secrete  -> %{http_code} (200 attendu)
" -H "apikey: $(grep SUPABASE_SECRET_KEY .env.supabase | cut -d= -f2)" "$U/annonces?select=id&limit=1"
```

Stockage des photos (bucket `medias`, public en lecture) : le bucket doit
exister et rester public, écriture réservée à la clé secrète.

```bash
curl -s "https://ocapkeuidpuhcsnerkse.supabase.co/storage/v1/bucket/medias"   -H "apikey: $(grep SUPABASE_SECRET_KEY .env.supabase | cut -d= -f2)"   -H "authorization: Bearer $(grep SUPABASE_SECRET_KEY .env.supabase | cut -d= -f2)"
# attendu : "public":true, "file_size_limit":5242880
```

## 3 bis. Supabase (connexion)

Le Worker doit refuser un jeton absent ou inventé :

```bash
curl -s -o /dev/null -w "sans jeton -> %{http_code} (401 attendu)\n" $W/api/profil
curl -s -o /dev/null -w "faux jeton -> %{http_code} (401 attendu)\n" \
  -H "authorization: Bearer faux" $W/api/profil
```

Pour un parcours connecté complet sans boîte mail, lancer les tests Playwright
(`tests/README.md`) : ils obtiennent une vraie session avec la clé secrète.

## 4. Envoi des liens

Ne se vérifie que dans le tableau de bord Supabase (Authentication) :

- **URL Configuration** : *Site URL* `https://doneo-app.vercel.app`, et
  `https://doneo-app.vercel.app/**` dans les *Redirect URLs*. Sinon le lien
  ramène ailleurs que sur l'app.
- **SMTP** : un serveur personnalisé doit être configuré. Sans lui, Supabase
  n'envoie qu'aux membres de l'équipe du projet, deux fois par heure.

Un test réel envoie un vrai e-mail : demander avant.
