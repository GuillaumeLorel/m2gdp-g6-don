# Scripts de données

Chargent les référentiels et les données de démonstration dans **Supabase**.
Ils lisent les secrets de `.env.supabase` à la racine du dépôt (git-ignoré,
voir `docs/SETUP.md` § 3 bis).

Première installation, ou après une nouvelle migration du schéma :

```bash
cd scripts && npm install
node donnees/appliquer-migrations.mjs   # supabase/migrations/*.sql, rejouable
```

> ⚠️ Il n'y a **qu'une seule base** : ces scripts écrivent dans les données du
> site en ligne. Lancer d'abord avec `--simulation`, qui n'écrit rien.

| Script | Ce qu'il charge | Source |
| --- | --- | --- |
| `generer-illustrations.mjs` | 84 illustrations SVG dans `public/static/illustrations/categories/`, une par catégorie et sous-catégorie. N'écrit pas en base | `categories.json` : icône Lucide et teinte de chaque catégorie |
| `charger-categories.mjs` | Collection `categories` : 12 principales, 72 sous-catégories, avec leur `illustrationUrl` | [`specs/donnees/categories.json`](../../specs/donnees/categories.json) |

```bash
cd scripts && npm install                 # une fois : installe lucide-static
npm run illustrations                     # regenere les SVG
node donnees/charger-categories.mjs --simulation
node donnees/charger-categories.mjs
```

### Données de démonstration

| Script | Ce qu'il fait |
| --- | --- |
| `generer-donnees-demo.mjs` | Produit `specs/donnees/demo/utilisateurs.json` (110 profils) et `annonces.json` (149 annonces, une par objet de `catalogue-objets.mjs`). Déterministe : graine fixe. Chaque adresse est validée par le géocodage de la Géoplateforme |
| `generer-echanges-demo.mjs` | Produit `specs/donnees/demo/echanges.json` : 68 conversations, 50 réservations dans tous les états, 298 messages (#75), cohérents avec le statut des annonces. Dates relatives. Déterministe |
| `charger-donnees-demo.mjs` | Charge les associations (`specs/donnees/associations.json`), les profils, les annonces, leurs photos et les échanges. Met à jour sur place : les favoris, conversations et demandes de **vrais** membres sur les annonces de démo sont conservés. `--supprimer` retire uniquement la démo |

```bash
node donnees/generer-donnees-demo.mjs        # seulement pour regenerer les JSON
node donnees/generer-echanges-demo.mjs       # idem pour les echanges
node donnees/charger-donnees-demo.mjs --simulation
node donnees/charger-donnees-demo.mjs
node donnees/charger-donnees-demo.mjs --supprimer
```

Avant une démo, relancer le chargement : les créneaux des annonces en ligne
avancent de semaines entières jusqu’à être à venir (même jour, même heure),
et les échanges sont datés par rapport à l’instant du chargement.

Les profils et annonces de démo portent `fictif: true`. 44 annonces ont une
photo (`specs/donnees/demo/photos.json`, crédits dans `CREDITS-PHOTOS.md`),
envoyée dans Supabase Storage ; les autres gardent l’illustration de leur
catégorie. Les annonces ont un
identifiant en `demo-` ; les profils, un UUID tiré de leur identifiant lisible
(`identifiants.mjs`), comme les comptes Supabase. Les e-mails sont en
`@example.org`, un domaine réservé qui ne reçoit jamais de message : personne
ne s'y connecte, sauf les tests automatisés.

### Comptes du cours

`creer-comptes-cours.mjs` crée un compte pour chaque étudiant du cours et pour
l'enseignant (mail du 24/10/2026) : compte de connexion déjà confirmé, profil
rempli avec les deux rôles, adresse et date de naissance tirées au hasard. La
liste vient de `comptes-cours.local.json`, **git-ignoré** — des e-mails réels
n'ont rien à faire dans un dépôt public :

```json
{ "comptes": [{ "prenom": "…", "nom": "…", "email": "…" }] }
```

```bash
node donnees/creer-comptes-cours.mjs --simulation
node donnees/creer-comptes-cours.mjs
```

Rejouable : un compte ou un profil existant n'est pas modifié.

Les **associations sont réelles** (nom, RNA, siège : annuaire des entreprises),
les présentations sont des résumés rédigés pour la démo.

Les illustrations reprennent le langage de la charte (`design/illustrations`) :
trait ardoise épais, aplats pastel, et la teinte de la catégorie principale en
fond, pour qu'une famille d'objets se reconnaisse dans une liste.

`migrer-depuis-firestore.mjs` a servi une fois, le 24/10/2026, à recopier les
vrais profils de Firestore vers Supabase ; Firestore reste en sauvegarde.

Les scripts sont **rejouables** : les identifiants sont stables, relancer met à
jour sans dupliquer.
