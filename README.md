# Donéo — Don caritatif par la vente d'objets

Projet Gestion de Projet M2CIM 2026/2027 — Groupe 6.

Plateforme de **don caritatif par la vente d'objets**. Un **offrant** cède ce
dont il n'a plus l'usage — mobilier, électroménager, matériel scolaire,
vêtements — fixe une **participation solidaire** et choisit une **association**.
Un **demandeur** — étudiant, ou personne dans le besoin — verse cette
participation et vient récupérer l'objet en main propre.

**L'offrant ne touche pas l'argent** : la totalité va à l'association qu'il a
choisie. C'est ce qui fait de la vente un don. Le demandeur, lui, repart avec
l'objet **à petit prix**.

La participation n'est pas un prix de marché. Elle reste **modeste** : ce qu'elle
achète, ce n'est pas la valeur de l'objet, c'est le geste de soutenir une
association. Pas d'enchère non plus — le montant est fixé une fois pour toutes
par l'offrant.

L'offrant définit aussi un **créneau de retrait**, et l'**adresse exacte n'est
révélée qu'une fois la participation validée** — avant, le demandeur ne voit
qu'un lieu approximatif (code postal et ville). Les rôles `offrant` et
`demandeur` sont **cumulables** sur un même compte.

> ⚠️ Le **paiement passe par un vrai prestataire, en mode test uniquement** :
> le tunnel est réellement parcouru, mais le montant débité est 0. Aucune
> transaction ni aucun reversement réels.

## Structure du dépôt

| Répertoire   | Contenu                                                        |
|--------------|----------------------------------------------------------------|
| `/landing`   | Site vitrine statique. https://doneo-vitrine.vercel.app        |
| `/public`    | Application web frontend (PWA). https://doneo-app.vercel.app   |
| `/workers`   | Logique métier backend (Cloudflare Workers)                    |
| `/docs`      | Documentation technique et guides                              |
| `/design`    | Artefacts UX en HTML (charte graphique, maquettes)             |
| `/specs`     | Artefacts PO (specs OpenAPI, diagrammes Mermaid, données JSON) |
| `/tests`     | Tests automatisés Playwright (scripts, résultats)              |
| `agents.md`  | Instructions générales pour l'IA                               |

## Stack technique

- **Frontend** : PWA React, **Tailwind CSS v4 + shadcn/ui** (et non Material
  Design), LeafletJS (carte), Google Places API (géolocalisation)
- **Backend** : Cloudflare Workers (logique métier)
- **Auth** : Supabase Auth (lien magique, sans mot de passe, région UE)
- **Données** : Supabase Postgres (région UE, `eu-west-1`), via le Worker
- **Fichiers** : Cloudflare R2
- **Sessions** : Cloudflare D1 (SQL)
- **Hébergement** : Vercel (front et vitrine)

## Démarrage

Nouveau sur le projet ? Tout est dans [`docs/SETUP.md`](docs/SETUP.md) :
lancer le front en local (sans aucun secret), les accès à demander, les
branches et la règle de déploiement.

En bref :

- On travaille sur une branche `feat/…` créée depuis **`develop`**, et on
  ouvre une PR vers `develop`.
- **On ne déploie que depuis `main`**, à jour.

## Équipe

- PO : _à compléter_
- UX : _à compléter_
- DEV : Guillaume, _second dev à compléter_
- Sponsor / Manager : @quangfr
