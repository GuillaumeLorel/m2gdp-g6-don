# Donéo — Site vitrine statique

Site vitrine statique pour Donéo, en HTML / CSS / JavaScript vanilla, sans
étape de build. Prêt à être déployé sur Firebase Hosting.

## Prérequis

- Un compte Google et un projet Firebase créé sur https://console.firebase.google.com
- Node.js installé (pour la CLI Firebase uniquement)
- La CLI Firebase : `npm install -g firebase-tools`

## Aperçu local

Aucune étape de build n'est nécessaire. Ouvrez directement
`public/index.html` dans un navigateur, ou servez le dossier `public/` avec
un serveur statique quelconque, par exemple :

```bash
npx serve public
```

## Déploiement sur Firebase Hosting

Depuis la racine du projet (là où se trouve `firebase.json`) :

```bash
firebase login
firebase init hosting
firebase deploy
```

Lors de `firebase init hosting`, répondez :
- dossier public : `public` (déjà configuré dans `firebase.json`)
- application une page (SPA) : non
- fichier déjà existant : ne pas écraser `index.html` / `404.html`

Le projet Firebase utilisé par défaut est `doneo-app` (voir `.firebaserc`).
Remplacez cet identifiant par celui de votre propre projet Firebase si besoin.

## Polices et illustrations : état actuel

Toutes les polices et illustrations nécessaires sont désormais présentes et
branchées. Il n'y a plus de fichier à déposer pour que le site s'affiche
avec son identité graphique définitive.

### Polices

`public/css/style.css` déclare les polices directement à partir des
fichiers présents dans `public/assets/fonts/` :

- **Asgard** : `AsgardTrial-FitRegular.ttf` (graisse 400) et
  `AsgardTrial-FitBold.ttf` (graisse 700), au format TrueType.
  Caractères accentués français vérifiés (table `cmap`) : **é, è, à, ç, ô, É
  et l'ensemble Latin-1 / Latin étendu-A sont bien présents dans ces deux
  graisses** — aucun caractère manquant. La version d'essai ne contient en
  revanche **aucun chiffre** : les déclarations `@font-face` d'Asgard excluent
  U+0030–0039 (`unicode-range`) et `--font-titre` place Inter juste après
  Asgard, si bien que les chiffres des titres s'affichent en Inter.
- **Inter** : police variable, servie depuis les fichiers web optimisés
  `public/assets/fonts/web/InterVariable.woff2` et
  `InterVariable-Italic.woff2`. Une seule déclaration `@font-face` par style
  (normal / italique), avec `font-weight: 100 900`, couvre toutes les
  graisses utilisées dans le CSS (400, 600, 700, 800...).

⚠️ **Licence** : les fichiers `AsgardTrial-*` proviennent d'une distribution
d'essai (« Trial ») sous licence CC-BY-NC (voir
`public/assets/fonts/Asgard-Family-CC-BY-NCLicensepdf.pdf`), donc à usage non
commercial — cohérent avec le cadre de ce projet étudiant, mais à vérifier
avant tout usage en dehors de ce contexte.

### Illustrations

`public/assets/illustrations/` contient désormais le vrai logo déposé et les
10 illustrations officielles de la marque (`objet-*.svg`, `expression-*.svg`),
réparties sur les emplacements principaux du site. Voir le tableau détaillé
dans la réponse associée à cette mise à jour pour la correspondance
fichier → emplacement.

Un sous-dossier `public/assets/illustrations/icons/` a été ajouté : il
contient 9 icônes au trait simples et cohérentes entre elles (créées pour ce
projet, pas des illustrations de marque), utilisées uniquement pour les
petites icônes des cartes « Le concept » et « Ce que fait l'application ».

Trois illustrations de marque fournies ne sont pour l'instant utilisées à
aucun emplacement du site (aucun slot ne s'y prêtait mieux qu'aux autres) :
`objet-etoile.svg`, `expression-heureux.svg`, `expression-triste.svg`.
Elles restent disponibles dans le dossier pour un usage futur.

## Application web, captures d'écran et QR code

Donéo est une application web, accessible à l'adresse https://doneo.web.app/.
Tous les appels à l'action du site vitrine y renvoient, dans un nouvel onglet.

- `public/assets/screens/*.webp` : écrans de l'application, recadrés à partir
  des exports de maquettes conservés dans `public/assets/screens/originaux/`.
  Pour régénérer (ou ajouter une capture) : déposer le PNG dans
  `public/assets/screens/`, puis `npm i sharp && node scripts/recadrer-captures.mjs` (ou
  `node scripts/recadrer-captures.mjs creation-annonce` pour une seule capture).
- `public/assets/qr-doneo.svg` : QR code statique vers https://doneo.web.app/,
  affiché dans le bloc d'appel à l'action final (masqué sous 640px). Il a été
  généré une seule fois ; aucune librairie QR n'est chargée par le site. Pour
  le régénérer :
  `npx qrcode -t svg -e M -q 4 -d 2F4F5C -l FFFFFF -o public/assets/qr-doneo.svg "https://doneo.web.app/"`
- `public/assets/illustrations/logo-doneo.svg` : son `viewBox` est recadré au
  ras des lettres DONÉO (accent compris), sans marge vide ; la hauteur fixée
  en CSS est donc celle du mot.

## Version de démonstration (non indexée)

Le site est une version de démonstration : `<meta name="robots" content="noindex, nofollow">`
sur toutes les pages, `robots.txt` en `Disallow: /`, en-tête `X-Robots-Tag: noindex`
sur toutes les routes (`firebase.json`) et pas de `sitemap.xml`.

## Formulaire de contact (démonstration)

Le formulaire de contact (`public/index.html`, section « Une question ?
Écrivez-nous ») est un formulaire de démonstration : il n'a pas d'attribut
`action` et n'envoie aucune donnée. La validation reste faite côté client
(`public/js/main.js`) ; une fois le formulaire valide, les champs sont
réinitialisés et un message invite à écrire à hello@doneo.fr.

## Arborescence

```
/
├── firebase.json
├── .firebaserc
├── README.md
└── public/
    ├── index.html
    ├── mentions-legales.html
    ├── cgv.html
    ├── confidentialite.html
    ├── 404.html
    ├── robots.txt
    ├── favicon.svg
    ├── css/
    │   └── style.css
    ├── js/
    │   └── main.js
    └── assets/
        ├── qr-doneo.svg        (QR code vers https://doneo.web.app/)
        ├── fonts/
        │   └── web/            (woff2 optimisés, utilisés par le CSS)
        ├── illustrations/
        │   └── icons/          (icônes au trait pour les cartes)
        └── screens/            (captures de l'application)
```

## Partenariats associatifs

Les associations présentées dans la section « Des causes que vous pouvez soutenir »
(Emmaüs, Les Restos du Cœur, Secours Populaire, La Croix-Rouge française, Les
Petits Frères des Pauvres, Le Secours Catholique) sont citées à titre
fictif, dans le cadre de ce projet étudiant. Aucune de ces associations n'est
réellement partenaire de Donéo.
