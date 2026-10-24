---
name: verif-infra
description: Vérifie de bout en bout que toute la stack serverless du projet Donéo répond — worker Cloudflare, D1, R2, Firestore, Realtime Database, Auth et les deux sites Hosting. À utiliser avant une démo (J3, J4, J5), après un déploiement, ou quand quelque chose « ne marche plus » sans qu'on sache quel service est en cause.
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

## 2. Cloudflare D1 et R2

Depuis `workers/`, avec `wrangler` authentifié. Le drapeau `--remote` est
indispensable : sans lui, wrangler tape une base locale et le test ne prouve
rien.

```bash
wrangler d1 execute doneo-sessions --remote --yes \
  --command "CREATE TABLE IF NOT EXISTS smoke_test (id INTEGER PRIMARY KEY, note TEXT); \
             INSERT INTO smoke_test (note) VALUES ('verif'); SELECT * FROM smoke_test;"
wrangler d1 execute doneo-sessions --remote --yes --command "DROP TABLE smoke_test;"

echo test > /tmp/smoke.txt
wrangler r2 object put doneo-fichiers/smoke.txt --file /tmp/smoke.txt --remote
wrangler r2 object get doneo-fichiers/smoke.txt --file /tmp/dl.txt --remote
wrangler r2 object delete doneo-fichiers/smoke.txt --remote
```

Vérifier aussi que les secrets sont toujours en place — ils disparaissent si le
Worker est recréé :

```bash
wrangler secret list   # attendu : FIREBASE_SERVICE_ACCOUNT et FIREBASE_API_KEY
```

## 3. Firebase (Firestore, Realtime DB, Auth)

Pas besoin de `firebase login` : la clé de service à la racine du dépôt suffit.
Signer un JWT RS256 avec `private_key`, l'échanger contre un jeton OAuth sur
`https://oauth2.googleapis.com/token`, puis appeler les API REST :

- Firestore : `PATCH`/`GET`/`DELETE` sur
  `https://firestore.googleapis.com/v1/projects/doneo-3561b/databases/(default)/documents/smoke_test/verif`
- Realtime DB : `PUT`/`GET`/`DELETE` sur
  `https://doneo-3561b-default-rtdb.europe-west1.firebasedatabase.app/smoke_test.json`
- Config Auth : `GET https://identitytoolkit.googleapis.com/admin/v2/projects/doneo-3561b/config`

Scopes nécessaires : `cloud-platform`, `firebase.database`, `userinfo.email`.

**Piège connu** : dans la réponse de la config Auth, un booléen absent vaut
`false` (l'API omet les valeurs par défaut). On ne peut donc **pas** conclure de
l'absence de `passwordRequired` que le lien magique est activé. Le seul test
fiable est un envoi réel via `accounts:sendOobCode` avec
`requestType: EMAIL_SIGNIN` — qui échoue en `OPERATION_NOT_ALLOWED` si le
fournisseur est désactivé. Attention : cela envoie un vrai email, demander avant.

## 4. Domaines autorisés

Après création d'un site Hosting, son domaine n'est **pas** ajouté
automatiquement aux domaines autorisés de Firebase Auth. Tout lien magique
redirigeant vers ce domaine sera rejeté. Vérifier que `authorizedDomains`
contient bien `doneo-app.vercel.app`.
