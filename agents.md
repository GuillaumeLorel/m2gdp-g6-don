# Instructions IA — m2gdp-g6-don

Ce fichier guide les agents IA (IDE, Copilot, etc.) qui travaillent sur ce dépôt.

## Contexte projet

Marketplace **d'enchères caritatives** (nom de code DON). Deux populations :

- **Vendeurs** : cèdent des objets inutilisés (mobilier, électroménager…).
- **Acheteurs** : font des offres ; la meilleure enchère remporte l'objet.

Spécificités métier :

- Le prix n'est pas fixe : mécanique **d'enchère** (offres montantes, meilleure
  offre gagnante).
- L'argent de la vente est **reversé à une cause caritative**.
- Les acheteurs viennent **récupérer l'objet chez le vendeur** (dimension de
  proximité géographique).
- Une enchère a une **date de fin** (dimension de disponibilité dans le temps).

## Périmètre d'évaluation

- ✅ Évalué : engagement (roadmap réalisée), ergonomie (navigation claire,
  responsive, mobile-first), fonctionnel (scénario nominal + cas à la marge),
  réalisme des données (90+ annonces, 30+ profils, 10+ conversations, 10+
  enchères/réservations).
- ❌ Non évalué : architecture et qualité du code, sécurité, infra, performance.
  Le back est délégué à des services auto-gérés (Firebase, Cloudflare).

> Ne pas travailler sur ce qui n'est pas demandé.

## Conventions

- Frontend **mobile-first**, framework Material Design.
- Données fictives **variées et réalistes**, vocabulaire français sans faute.
- Le backend (Workers) délègue aux services auto-gérés ; les secrets Firebase
  restent dans le Worker, jamais exposés côté public.
- Front public déployé via Firebase Hosting ; Workers déployés via
  `wrangler deploy`.

## Ce que l'IA ne doit pas faire

- Ne jamais committer de secrets (service account key Firebase, tokens
  Cloudflare, `.env`). Voir `.gitignore`.
- Ne pas gérer les problèmes de production (volumétrie, scalabilité).
