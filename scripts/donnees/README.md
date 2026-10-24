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
| `charger-donnees-demo.mjs` | Charge les associations (`specs/donnees/associations.json`), les profils et les annonces. `--supprimer` retire uniquement la démo |

```bash
node donnees/generer-donnees-demo.mjs        # seulement pour regenerer les JSON
node donnees/charger-donnees-demo.mjs --simulation
node donnees/charger-donnees-demo.mjs
node donnees/charger-donnees-demo.mjs --supprimer
```

Les profils et annonces de démo ont un identifiant en `demo-` et portent
`fictif: true`. Les e-mails sont en `@example.org`, un domaine réservé qui ne
reçoit jamais de message. Ces comptes n'existent pas dans Firebase Auth : ils
apparaissent dans l'annuaire et comme offrants, mais personne ne peut s'y
connecter.

Les **associations sont réelles** (nom, RNA, siège : annuaire des entreprises),
les présentations sont des résumés rédigés pour la démo.

Les illustrations reprennent le langage de la charte (`design/illustrations`) :
trait ardoise épais, aplats pastel, et la teinte de la catégorie principale en
fond, pour qu'une famille d'objets se reconnaisse dans une liste.

`migrer-depuis-firestore.mjs` a servi une fois, le 24/10/2026, à recopier les
vrais profils de Firestore vers Supabase ; Firestore reste en sauvegarde.

Les scripts sont **rejouables** : les identifiants sont stables, relancer met à
jour sans dupliquer.
