# Instructions IA — Donéo

Ce fichier guide les agents IA (IDE, Copilot, etc.) qui travaillent sur ce dépôt.

## Contexte projet

**Donéo** — plateforme de **don caritatif via la vente d'objets**. Trois
acteurs :

- **Offrant** : cède un objet, **fixe une participation solidaire** — un montant
  modeste — et **choisit une association** dans une liste. Définit un créneau de
  retrait. Il ne touche pas l'argent — c'est ce qui fait de la vente un don.
- **Demandeur** : un **étudiant ou une personne dans le besoin**. Il verse la
  participation et repart avec **l'objet à petit prix** ; il vient le récupérer
  sur place.
- **Association** : reçoit **l'argent** versé par le demandeur.

Les rôles `offrant` et `demandeur` sont **cumulables** sur un même compte.

Spécificités métier :

- La **participation est fixée par l'offrant** (obligatoire) et **versée
  intégralement à l'association** choisie. Pas d'enchère, pas d'offre montante :
  un montant fixe, et modeste — ce n'est pas le prix de l'objet mais une
  contribution à une cause. Aucun plafond n'est imposé techniquement.
- L'offrant définit un **créneau ponctuel** (tranche horaire de disponibilité
  pour le retrait).
- **Adresse à deux niveaux** : le demandeur voit un **lieu approximatif**
  (code postal, ville) et le créneau **avant** de verser la participation ;
  l'**adresse exacte n'est révélée qu'après validation de la participation**.
- Le **paiement passe par un vrai prestataire, en mode test uniquement**. Il est
  réellement validé (tunnel, confirmation, référence de transaction), mais le
  **montant affiché est la participation demandée tandis que le montant débité
  est 0** : aucune transaction réelle, aucun reversement réel à l'association.
  C'est le passage à `statutPaiement = paye` qui débloque l'adresse exacte.

## Périmètre d'évaluation

- ✅ Évalué : engagement (roadmap réalisée), ergonomie (navigation claire,
  responsive, mobile-first), fonctionnel (scénario nominal + cas à la marge),
  réalisme des données (90+ annonces, 30+ profils, 10+ conversations, 10+
  réservations).
- ❌ Non évalué : architecture et qualité du code, sécurité, infra, performance.
  Le back est délégué à des services auto-gérés (Firebase, Cloudflare, Vercel).

> Ne pas travailler sur ce qui n'est pas demandé.

## Conventions

- Frontend **mobile-first**, en **Tailwind CSS v4 + shadcn/ui** (et non Material
  Design : arbitrage acté le 16/09/2026).
- Données fictives **variées et réalistes**, vocabulaire français sans faute.
- Le backend (Workers) délègue aux services auto-gérés ; les secrets Firebase
  restent dans le Worker, jamais exposés côté public.
- Front public et vitrine hébergés sur **Vercel** (projets `doneo` et
  `doneo-vitrine`) ; Workers déployés via `wrangler deploy`. Services cloud
  hébergés en France ou dans l'UE (demande du 11/10/2026).

## Branches et déploiement

Détail dans [`docs/SETUP.md`](docs/SETUP.md) § 5.

- `main` = ce qui est en ligne ; `develop` = intégration ; une branche
  `feat/<n°>-<sujet>` (ou `fix/…`, `docs/…`) par ticket, créée depuis
  `develop`.
- Le travail arrive dans `develop` **par pull request**, et dans `main` par
  fusion de `develop`. Ne jamais commiter directement sur `main` ni `develop`.
- **Ne déployer que depuis `main` à jour** (`git checkout main && git pull`) :
  déployer depuis une autre branche efface du site en ligne le travail des
  autres.
- Jamais de `git push --force` sur `main` ni `develop`.

## Ce que l'IA ne doit pas faire

- Ne jamais committer de secrets (service account key Firebase, tokens
  Cloudflare, `.env`). Voir `.gitignore`.
- Ne pas gérer les problèmes de production (volumétrie, scalabilité).
- Ne **jamais** exposer `numeroRue`, `rue` ni `complementAdresse` sur une route
  publique : ces trois champs forment l'adresse exacte, révélée seulement **après
  validation de la participation** (`statutPaiement = paye`). Filtrer par liste
  blanche (ne laisser sortir que les champs explicitement publics), jamais par
  liste noire.
- **Nommer tous les champs en français**, y compris les clés étrangères
  (`offrantId`, `associationId`, `demandeurId`) et les valeurs
  d'énumération. Pas de `title`, `price` ni `createdAt` — et le montant s'appelle
  `participation`, jamais `prix`.
