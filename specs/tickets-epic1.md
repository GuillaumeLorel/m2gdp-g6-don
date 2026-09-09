# Tickets — EPIC-0 et EPIC-1

Corps prêts à coller dans GitHub. Les tickets existants sont **modifiés en
place** ; les autres sont à créer.

## Arbitrages actés

1. **Les rôles sont cumulables** — donateur *et/ou* bénéficiaire. Un même compte
   peut donner ce dont il n'a plus l'usage tout en cherchant autre chose : c'est
   le cas courant entre étudiants, pas l'exception. Le champ devient une liste
   `roles[]`.
2. **La photo sort du périmètre MVP** de l'US-1. Le CA2 la listait parmi les
   champs requis, mais téléverser un fichier vers R2 est un travail à part
   entière, et le stockage de fichiers est classé SHOULD dans la priorisation du
   cours. Le formulaire garde l'emplacement visuel ; `photoUrl` reste vide.
   *(À confirmer par le PO.)*
3. **La déconnexion rejoint l'US-2** — l'EPIC parle d'identité *et d'accès*,
   sortir en fait partie.
4. **L'annuaire des inscrits obtient sa propre US** (US-3) : la J2 l'exige, mais
   aucune des deux US existantes ne le justifiait.

## Arborescence cible

```
EPIC-0 · Socle technique et mise en ligne
├── TASK-1  (#4, fermé) Initialiser Firebase Auth et Firestore
├── TASK-9  Provisionner Cloudflare (D1, R2, Worker, secrets)
├── TASK-10 Monter le squelette de la PWA
├── TASK-11 Configurer l'outillage agentique (MCP, skills)
└── TASK-12 Déployer et vérifier la chaîne de bout en bout

EPIC-1 · Authentification et profil utilisateur
├── US-1 (#2) Inscription et création de profil
│   ├── TASK-2 (#5) Vues de saisie e-mail
│   ├── TASK-5     Passerelle backend
│   ├── TASK-6     Formulaire de profil
│   └── TASK-7     Lien expiré
├── US-2 (#3) Connexion utilisateur existant
│   ├── TASK-3 (#6) Envoi du lien magique
│   └── TASK-4 (#7) Retour du lien, session et déconnexion
└── US-3     Consulter les membres inscrits
    └── TASK-8     Annuaire des inscrits
```

---
---

# 🆕 [EPIC-0] Socle technique et mise en ligne

***

### Objectif de l'EPIC
Disposer d'une chaîne complète et vérifiée — front, backend, bases de données, stockage, hébergement — avant d'écrire la moindre fonctionnalité métier, et pouvoir la redéployer à volonté.

### Périmètre fonctionnel
- Architecture serverless imposée : Firebase (Auth, Firestore, Realtime Database, Hosting) et Cloudflare (Workers, D1, R2).
- Le front n'accède jamais aux services directement : il passe par le Worker, seul détenteur de la clé de service.
- Application front sous forme de PWA installable.
- Outillage de développement assisté par IA (MCP, skills projet) versionné dans le dépôt.

### Hors périmètre
- Toute logique métier (dons, demandes, messagerie) : voir les EPIC suivants.
- Sécurité, performance et scalabilité de production, explicitement hors barème.

### Tâches associées
- [x] TASK-1 : Initialiser Firebase Auth et Firestore
- [ ] TASK-9 : Provisionner Cloudflare (D1, R2, Worker, secrets)
- [ ] TASK-10 : Monter le squelette de la PWA
- [ ] TASK-11 : Configurer l'outillage agentique (MCP, skills)
- [ ] TASK-12 : Déployer et vérifier la chaîne de bout en bout

***

---

# ✏️ #4 · [TASK-1] Initialiser Firebase Auth et Firestore

*Ticket déjà fermé. Rattacher à l'EPIC-0 et ajouter la note finale.*

***

- [x] Configurer le projet Firebase dans la console.
- [x] Activer la méthode d'authentification « Email/Password » et spécifiquement l'option « Email link (passwordless sign-in) ».
- [x] Créer la collection Utilisateur dans Firestore (NoSQL).
- [x] Générer et intégrer les clés de configuration Firebase dans le projet Front-end.

> **Note** : une collection Firestore n'a pas à être créée à l'avance, elle naît
> à la première écriture — le troisième point était sans objet.
> Projet : `projet-bon-debarras`. Lien magique **vérifié par envoi réel**.

***

---

# 🆕 [TASK-9] Provisionner Cloudflare (D1, R2, Worker, secrets)

***

- [ ] Créer la base D1 `m2gdp-g6-don-sessions` et reporter son `database_id` dans `wrangler.toml`.
- [ ] Activer le service R2 sur le compte, puis créer le bucket `m2gdp-g6-don-fichiers`.
- [ ] Déployer le Worker et exposer un healthcheck `GET /api/health`.
- [ ] Enregistrer les secrets `FIREBASE_SERVICE_ACCOUNT` et `FIREBASE_API_KEY`.
- [ ] Documenter la procédure dans `docs/SETUP.md`.

**Pièges rencontrés, à conserver dans la doc :**
- R2 exige une **activation préalable** du service sur le compte (erreur `code: 10042` sinon), avec moyen de paiement même en palier gratuit.
- `wrangler secret put` sur un Worker inexistant ouvre une **invite interactive** : il faut déployer *avant* de poser les secrets.
- Le `binding` suggéré par `wrangler d1 create` est ignoré : on garde `DB_SESSIONS`, le nom lu par le code.

***

---

# 🆕 [TASK-10] Monter le squelette de la PWA

***

- [ ] Initialiser Vite + React + Tailwind + shadcn/ui dans `/public`.
- [ ] Configurer `publicDir` sur `static/` et la sortie de build sur `public/dist`, cible du Hosting.
- [ ] Ajouter le `manifest.webmanifest` et les icônes 192 et 512 px.
- [ ] Écrire un service worker : **réseau d'abord** sur la navigation, `/api/` **jamais** mis en cache.
- [ ] Poser des jetons de couleur neutres, remplaçables à l'arrivée de la charte UX.

> **Choix** : JavaScript et non TypeScript. TS est passé en 7.0, une réécriture
> majeure dont l'outillage n'a pas fini de suivre — mauvais pari à 7 jours de la J2.

***

---

# 🆕 [TASK-11] Configurer l'outillage agentique (MCP, skills)

***

Couvre la ligne « Agentic Coding : IDE avec IA, Skills et MCP configurés » de la checklist J2.

- [ ] Déclarer les serveurs MCP dans un `.mcp.json` **versionné**, avec versions épinglées.
- [ ] `playwright` — pilotage navigateur pour les tests E2E exigés au barème.
- [ ] `shadcn` — registre de composants UI.
- [ ] Écrire les skills projet dans `.claude/skills/` : `deployer` et `verif-infra`.
- [ ] Y consigner les pièges déjà rencontrés, pour ne pas les redécouvrir en J4.

***

---

# 🆕 [TASK-12] Déployer et vérifier la chaîne de bout en bout

***

- [ ] Créer les deux sites Hosting et lier les cibles `landing` et `app`.
- [ ] Déployer la vitrine et l'application.
- [ ] Vérifier **chaque service par une écriture suivie d'une lecture, puis nettoyage** : D1, R2, Firestore, Realtime Database.
- [ ] Vérifier le Worker : healthcheck, route inconnue, préflight CORS.
- [ ] Vérifier que le CORS **refuse** une origine non autorisée.

> **Piège** : un site Hosting nouvellement créé n'est **pas** ajouté
> automatiquement aux domaines autorisés de Firebase Auth. Tout lien magique
> pointant vers ce domaine est alors rejeté sans explication.

***

---
---

# ✏️ #1 · [EPIC-1] Authentification et profil utilisateur

***

### Objectif de l'EPIC
Gérer l'identité et l'accès des utilisateurs à la plateforme de dons de manière fluide et sécurisée, sans utiliser de mots de passe, à travers un lien magique.

### Périmètre fonctionnel
- Inscription et connexion via e-mail avec un "Lien magique".
- Création du profil obligatoire pour les nouveaux utilisateurs après le clic sur le lien.
- Champs du profil : nom, prénom, date de naissance, **rôles (donateur et/ou bénéficiaire, cumulables)**, adresse, code postal.
- Déconnexion.
- Consultation des membres inscrits.
- **Passerelle backend** : le front n'accède jamais à Firestore directement. Il présente son jeton d'identité, le Worker Cloudflare le vérifie, puis agit avec la clé de service.

### User Stories associées
- [ ] US-1 : Inscription et création de profil
- [ ] US-2 : Connexion utilisateur existant
- [ ] US-3 : Consulter les membres inscrits

***

---

# ✏️ #2 · [US-1] Inscription et création de profil

***

### Titre
En tant que nouveau visiteur, je veux m'inscrire via un lien magique envoyé par e-mail sans avoir à créer de mot de passe, afin d'accéder de manière fluide et sécurisée à la plateforme de dons.

### Spécifications fonctionnelles
**Contexte :** Pour maximiser le taux de conversion, l'utilisateur n'a pas besoin de retenir un mot de passe. Il renseigne son e-mail.
**Happy Path :**
- L'utilisateur saisit son e-mail sur la page d'inscription.
- Le système indique si l'adresse a déjà un compte, puis envoie le lien magique. **Le lien est le même dans les deux cas ; seul le message affiché diffère.**
- L'utilisateur clique sur le lien dans sa boîte mail. Firebase crée le compte à la consommation du lien.
- Il est redirigé vers un formulaire pour compléter son profil : nom, prénom, rôles (donateur et/ou bénéficiaire), adresse, code postal, date de naissance.
- Validation et redirection vers la page d'accueil en mode connecté.

### Critères d'acceptation
- [ ] **CA1 (Happy Path) :** Le champ e-mail possède une validation syntaxique en temps réel. Un message de confirmation est affiché après l'envoi du lien.
- [ ] **CA2 (Happy Path) :** Après avoir cliqué sur le lien, le formulaire d'inscription affiche bien les champs requis (nom, prénom, **rôles — plusieurs choix possibles**, adresse, code postal, date de naissance). La soumission crée le compte.
- [ ] **CA3 (Erreur gérée) :** Si le format de l'e-mail est invalide, le bouton de soumission est bloqué et un message d'aide apparaît.
- [ ] **CA4 (Erreur gérée) :** Si le lien magique est expiré, une page d'erreur propose de renvoyer un nouveau lien.
- [ ] **CA5 (Erreur gérée) :** Si l'utilisateur n'est pas majeur, le bouton de soumission est bloqué et un message d'aide apparaît.
- [ ] **CA6 (Erreur gérée) :** Les champs sont validés côté serveur, pas seulement dans le navigateur. Une requête forgée est rejetée en `422`.

### Spécifications techniques
- **ST1 :** Implémentation de Firebase Auth avec _sendSignInLinkToEmail_.
- **ST2 :** Validation et consommation du lien via _signInWithEmailLink_.
- **ST3 :** À la complétion du profil, écriture d'un document dans la collection `utilisateurs` de Cloud Firestore **via le Worker** (`PUT /api/profil`), jamais depuis le front. Champs : `id`, `email`, `nom`, `prenom`, `photoUrl`, `adressePostale`, `codePostal`, `dateNaissance`, `roles[]`, `creeLe`, `misAJourLe`.
- **ST4 :** L'e-mail stocké est **repris du jeton d'identité vérifié, jamais du formulaire** : sinon n'importe qui pourrait s'enregistrer sous l'adresse d'un autre.

### Exclusions (Hors scope MVP)
- Pas de connexion via les réseaux sociaux (Google, Facebook) pour le moment.
- Pas de vérification d'identité poussée ou par SMS lors de l'inscription.
- **Pas de téléversement de photo de profil.** L'emplacement est affiché dans le formulaire, mais l'envoi vers Cloudflare R2 relève du lot « Stockage des photos et documents », classé SHOULD. `photoUrl` reste vide.
- Pas de modification ni de suppression du profil après création.

***

---

# ✏️ #3 · [US-2] Connexion utilisateur existant

***

### Titre
En tant qu'utilisateur déjà inscrit (donateur, bénéficiaire, ou les deux), je veux me connecter via un lien magique envoyé sur mon e-mail, afin de retrouver mon profil, mes dons et mes demandes.

### Spécifications fonctionnelles
**Contexte :** Fluidifier le retour de l'utilisateur sur l'application.
**Happy Path :**
- L'utilisateur saisit son e-mail sur la page de connexion.
- Le système reconnaît l'e-mail et envoie le lien magique. *(Même lien que pour une inscription — voir US-1.)*
- L'utilisateur clique sur le lien et est instantanément authentifié et redirigé vers l'accueil.

### Critères d'acceptation
- [ ] **CA1 (Happy Path) :** L'écran de confirmation invite clairement l'utilisateur à aller consulter sa boîte mail.
- [ ] **CA2 (Happy Path) :** Le clic sur le lien connecte l'utilisateur sans lui redemander son profil (reconnaissance).
- [ ] **CA3 (Erreur gérée) :** Si l'utilisateur clique sur le lien depuis un autre navigateur/appareil (cross-device), le système lui demande de resaisir son e-mail pour confirmer par sécurité.
- [ ] **CA4 (Happy Path) :** L'utilisateur peut se déconnecter depuis l'accueil et revient à l'écran de saisie d'e-mail.
- [ ] **CA5 (Erreur gérée) :** Un lien déjà consommé ne rouvre pas de session : le code à usage unique est retiré de l'URL après connexion, et un rafraîchissement de la page ne le rejoue pas.

### Spécifications techniques
- **ST1 :** Suivi en continu de l'état de connexion de l'utilisateur afin de mettre à jour automatiquement le contexte client dans le front-end.
- **ST2 :** Paramétrage de _ActionCodeSettings_ dans Firebase pour définir l'URL cible de redirection sécurisée. Le domaine cible doit figurer dans les **domaines autorisés** de Firebase Auth, sinon le retour est rejeté.

### Exclusions (Hors scope MVP)
- Pas de gestion du multi-sessions complexe.
- Aucun filtre anti-spam intégré (si l'e-mail arrive dans les indésirables, c'est hors de notre contrôle front).

***

---

# 🆕 [US-3] Consulter les membres inscrits

***

### Titre
En tant qu'utilisateur connecté, je veux voir qui est inscrit sur la plateforme, afin de me rassurer sur le fait que la communauté est réelle et active avant de proposer ou de demander un objet.

### Spécifications fonctionnelles
**Contexte :** Sur une plateforme de dons entre inconnus, la confiance est le premier frein. Voir d'autres membres réels lève ce frein. C'est aussi une exigence explicite de la J2 : « inscription pas à pas **et** affichage des utilisateurs ».
**Happy Path :**
- Une fois connecté et son profil complété, l'utilisateur arrive sur l'accueil.
- L'accueil affiche la liste des membres inscrits avec leur prénom, nom et rôles.
- Le compteur indique le nombre total d'inscrits.

### Critères d'acceptation
- [ ] **CA1 (Happy Path) :** La liste affiche prénom, nom et rôles de chaque inscrit, avec le total.
- [ ] **CA2 (Sécurité) :** Les adresses e-mail ne sont **jamais** exposées dans la réponse de l'API.
- [ ] **CA3 (Cas limite) :** Si aucun membre n'est inscrit, un message explicite est affiché plutôt qu'une liste vide.
- [ ] **CA4 (Erreur gérée) :** Si le chargement échoue, un message d'erreur est affiché sans casser le reste de l'accueil.

### Spécifications techniques
- **ST1 :** `GET /api/utilisateurs` sur le Worker, qui lit la collection `utilisateurs` et retire le champ `email` avant de répondre.

### Exclusions (Hors scope MVP)
- Pas de pagination ni de recherche dans l'annuaire.
- Pas de fiche profil détaillée par membre.
- Pas de photo dans la liste tant que le téléversement n'est pas fait.

***

---
---

# ✏️ #5 · [TASK-2][POC] Intégrer les vues de saisie e-mail

***

- [ ] Intégrer le composant (shadcn/ui) pour la saisie de l'e-mail (valable pour inscription et connexion).
- [ ] Ajouter la validation syntaxique en temps réel (regex email).
- [ ] Coder l'état d'attente lors de la soumission (bouton désactivé, libellé « Envoi en cours… »).
- [ ] Intégrer la page de confirmation « Consultez vos e-mails ».
- [ ] **Différencier le message affiché** selon que l'adresse a déjà un compte ou non, via `POST /api/auth/statut-email`.
- [ ] **Proposer « Utiliser une autre adresse »** depuis l'écran de confirmation (faute de frappe dans l'e-mail).

**Valide :** US-1 CA1, CA3 · US-2 CA1

***

---

# ✏️ #6 · [TASK-3] Implémenter l'envoi du lien magique via Firebase

***

- [ ] Créer la fonction appelant _sendSignInLinkToEmail_ de Firebase Auth.
- [ ] Configurer l'_ActionCodeSettings_ pour définir l'URL de redirection (vers l'application).
- [ ] Stocker temporairement l'e-mail saisi dans le _localStorage_ (nécessaire pour la vérification au retour).
- [ ] **Prévoir le repli si le `localStorage` est indisponible** (navigation privée, stockage bloqué) : ne pas échouer, redemander l'e-mail au retour.
- [ ] Gérer les erreurs d'envoi (message d'erreur lisible).
- [ ] **Vérifier que le domaine de redirection figure dans les domaines autorisés** de Firebase Auth.

**Valide :** US-1 ST1 · US-2 ST2

***

---

# ✏️ #7 · [TASK-4] Traiter la redirection, la session et la déconnexion

*(le corps est actuellement vide ; le titre gagne « et la déconnexion »)*

***

- [ ] Détecter un retour de lien magique (`isSignInWithEmailLink`).
- [ ] Consommer le lien via `signInWithEmailLink`.
- [ ] **Cross-device** : si l'e-mail n'est plus en mémoire locale, le redemander au lieu d'échouer → **CA3 (US-2)**.
- [ ] **Nettoyer l'URL après connexion** : le code à usage unique ne doit rester ni dans l'historique ni rejouable au rafraîchissement → **CA5 (US-2)**.
- [ ] Mettre en place l'observateur d'état de connexion alimentant le contexte client → **ST1 (US-2)**.
- [ ] Aiguiller après connexion : formulaire d'inscription si le profil n'existe pas, accueil sinon.
- [ ] **Déconnexion** depuis l'accueil, retour à l'écran de saisie d'e-mail → **CA4 (US-2)**.

**Valide :** US-1 ST2 · US-2 CA2, CA3, CA4, CA5, ST1

***

---

# 🆕 [TASK-5] Passerelle backend : vérification des jetons et accès Firestore

***

Aucune tâche ne couvrait le backend, alors que c'est l'architecture imposée par le cours : le front ne doit jamais écrire dans Firestore directement.

- [ ] Vérifier le jeton d'identité Firebase dans le Worker : signature RS256 contre les clés publiques Google, **et** expiration, date d'émission, audience, émetteur.
- [ ] Mettre en cache les clés publiques Google selon leur en-tête `Cache-Control`.
- [ ] Obtenir un jeton de service à partir de la clé privée (secret du Worker) pour appeler Firestore.
- [ ] Convertir entre le format typé de Firestore et des objets JavaScript ordinaires.
- [ ] Restreindre le CORS au domaine de l'application ; tolérer `localhost` en développement.
- [ ] `POST /api/auth/statut-email` — l'adresse a-t-elle déjà un compte.
- [ ] `GET /api/profil` — `404` explicite si le profil reste à créer.
- [ ] `PUT /api/profil` — validation serveur des champs, réponse `422` détaillée.

> Une signature valide ne suffit pas : sans contrôle de l'audience, un jeton émis
> pour un **autre** projet Firebase serait accepté.

**Valide :** US-1 ST3, ST4, CA6

***

---

# 🆕 [TASK-6] Formulaire de profil et enregistrement

***

- [ ] Champs : nom, prénom, **date de naissance**, rôles, adresse, **code postal**.
- [ ] **Bloquer la soumission si l'utilisateur n'est pas majeur**, avec message d'aide → **CA5**.
- [ ] Rôles en **cases à cocher** (cumulables), au moins un obligatoire.
- [ ] L'e-mail n'est pas saisissable : il est repris du jeton vérifié.
- [ ] Afficher le formulaire uniquement si `GET /api/profil` répond `404`.
- [ ] Rediriger vers l'accueil connecté après validation.
- [ ] Afficher l'emplacement de la photo, sans téléversement (hors scope MVP).

**Valide :** US-1 CA2, CA5

***

---

# 🆕 [TASK-7] Gérer le lien expiré ou déjà consommé

***

- [ ] Détecter les codes d'erreur Firebase `expired-action-code` et `invalid-action-code`.
- [ ] Afficher un écran dédié expliquant la cause, distinct d'une erreur technique.
- [ ] Proposer le renvoi d'un nouveau lien, avec temporisation anti-abus.

**Valide :** US-1 CA4

***

---

# 🆕 [TASK-8] Afficher l'annuaire des inscrits

***

- [ ] `GET /api/utilisateurs` — sans exposer les adresses e-mail.
- [ ] Liste sur l'accueil : initiale, prénom, nom, rôles.
- [ ] Afficher le nombre total d'inscrits.
- [ ] Gérer les états de chargement, de liste vide et d'erreur.

**Valide :** US-3 CA1, CA2, CA3, CA4, ST1

***

---
---

## 🔴 Note à retenir : il n'existe qu'un seul type de lien

L'US-1 disait que le système envoie « un lien d'**inscription** unique » si
l'e-mail n'existe pas, par opposition à un lien de **connexion** s'il existe.
**Firebase ne fonctionne pas ainsi.** `sendSignInLinkToEmail` envoie toujours le
même lien ; à sa consommation, Firebase crée le compte s'il n'existait pas, ou
ouvre la session s'il existait.

Croire à deux liens différents conduirait à chercher une API qui n'existe pas.
Ce qui diffère est **uniquement le message affiché** — d'où `statut-email`.

## Couverture des critères par les tâches

| Critère | Tâche | État du code |
|---|---|---|
| US-1 CA1, CA3 | TASK-2 (#5) | ✅ |
| US-1 CA2 | TASK-6 | ⚠️ manque date de naissance et code postal |
| US-1 CA4 | TASK-7 | ❌ |
| US-1 CA5 | TASK-6 | ❌ |
| US-1 CA6, ST3, ST4 | TASK-5 | ✅ |
| US-1 ST1 | TASK-3 (#6) | ✅ |
| US-1 ST2 | TASK-4 (#7) | ✅ |
| US-2 CA1 | TASK-2 (#5) | ✅ |
| US-2 CA2, CA3, CA5, ST1 | TASK-4 (#7) | ✅ |
| US-2 CA4 (déconnexion) | TASK-4 (#7) | ✅ |
| US-2 ST2 | TASK-3 (#6) | ✅ |
| US-3 CA1 → CA4, ST1 | TASK-8 | ✅ |
| EPIC-0 | TASK-1, 9, 10, 11, 12 | ✅ |

**US-2 et US-3 validables. US-1 non**, tant que TASK-6 et TASK-7 ne sont pas
terminées : il manque la date de naissance, le code postal, le contrôle de
majorité et l'écran de lien expiré.
