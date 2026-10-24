---
name: commiter
description: Commite et pousse selon les conventions de Donéo — branche de ticket depuis develop, PR vers develop, sans secrets, sans BOM dans le message. À utiliser dès qu'on demande de « commit », « push », « ouvrir une PR » ou « envoyer sur GitHub ».
---

# Commiter sur Donéo

## Branches

- `main` = ce qui est en ligne ; `develop` = intégration. **Ne jamais commiter
  directement sur l'une ni l'autre.**
- Travailler sur une branche de ticket créée depuis `develop` à jour :
  `feat/<n°>-<sujet>`, `fix/<n°>-<sujet>` ou `docs/<sujet>`.
- Pousser la branche, puis ouvrir une **PR vers `develop`**
  (`gh pr create --base develop`). Pas de relecture obligatoire.
- `develop` → `main` seulement pour une mise en ligne, par PR, à la demande de
  l'équipe — puis déployer depuis `main` (skill `deployer`).
- Jamais de `git push --force` sur `main` ni `develop`.

## Règles

- **Ajouter les fichiers un par un** (`git add chemin`), jamais `git add -A` ni
  `git add .`. Sont exclus d'office :
  - `doneo-3561b-firebase-adminsdk-*.json` (ancienne clé de service Firebase) ;
  - tout `.env`, `.env.supabase`, `.dev.vars`, token Cloudflare ;
  - `scripts/donnees/*.local.json` (e-mails réels des comptes du cours) ;
  - `.claude/settings.json` et `.claude/settings.local.json` (réglages locaux).
- **Ne pas toucher au `.gitignore`** sans demande explicite.
- Relire `git status` et `git diff --staged` avant de commiter.

## Message

Préfixe conventionnel en français (`feat:`, `fix:`, `docs:`, `chore:`), puis une
liste de ce qui change et pourquoi.

**Passer le message par Bash et un heredoc**, jamais par une chaîne PowerShell
redirigée : PowerShell 5.1 ajoute un BOM (`EF BB BF`) en tête du message, qui se
retrouve dans l'historique.

```bash
git commit -q -F - <<'EOF'
docs: resume court

- Detail 1.
- Detail 2.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push -u origin feat/12-fiche-annonce
```

Si le Bash de l'environnement ne trouve pas `git`, préfixer la commande par
`export PATH="/usr/bin:/mingw64/bin:$PATH";`.

## Avant de commiter

- Des specs ont changé : lancer la skill `valider-specs`.
- Le front a changé : `cd public && npm run build` doit passer.
- Ne jamais réécrire l'historique poussé (`--amend`, `--force`) sans accord
  explicite. Sur sa propre branche de ticket, c'est permis avec
  `--force-with-lease` ; sur `main` et `develop`, jamais.
