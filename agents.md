# Instructions IA — m2gdp-g6-don

Ce fichier guide les agents IA (IDE, Copilot, etc.) qui travaillent sur ce dépôt.

## Contexte projet

Plateforme de **dons d'objets entre particuliers** (nom de code DON).
Deux populations :

- **Donateurs** : cèdent gratuitement des objets dont ils n'ont plus l'usage
  (mobilier, électroménager, matériel scolaire, vêtements, puériculture…).
- **Bénéficiaires** : l'application vise surtout les **jeunes dans le besoin** —
  étudiants qui s'installent, personnes en difficulté — qui demandent ces objets.

> Les deux rôles sont **cumulables** : un même compte peut donner et recevoir.
> Le champ `roles` est donc une **liste** (`donateur`, `beneficiaire`), jamais
> une valeur unique. Ne pas le retransformer en type exclusif.

Spécificités métier :

- **Aucun argent ne circule.** Pas de prix, pas d'enchère, pas de commission,
  pas de paiement. Ne jamais introduire de champ monétaire dans le modèle.
- Ce qui départage plusieurs demandeurs, c'est la **motivation** exprimée, et
  le donateur **choisit** : pas d'attribution automatique.
- Les bénéficiaires viennent **récupérer l'objet chez le donateur** : la
  proximité géographique est un critère de recherche déterminant.
- Un don suit un cycle `disponible` → `reserve` → `remis`.

> ⚠️ Le projet a **changé de sujet en cours de route**. Il s'agissait
> initialement d'enchères caritatives. Tout vocabulaire d'enchère — vendeur,
> acheteur, offre, mise, enchérisseur, montant, cause caritative bénéficiaire —
> est **obsolète**. Si vous en croisez dans le dépôt, c'est un oubli à corriger.

## Périmètre d'évaluation

- ✅ Évalué : engagement (roadmap réalisée), ergonomie (navigation claire,
  responsive, mobile-first), fonctionnel (scénario nominal + cas à la marge),
  réalisme des données (90+ dons publiés, 30+ profils, 10+ conversations, 10+
  demandes).
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
