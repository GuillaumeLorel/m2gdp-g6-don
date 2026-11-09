-- Questions publiques sous les annonces (EPIC 9). Voir specs/data-model.md,
-- « Commentaires publics ».
--
-- Une question d'un demandeur, et au plus une reponse de l'offrant, portee par
-- la ligne elle-meme (`reponse`) : pas de fil de discussion public.
-- Meme regime que les autres tables : RLS active, aucune regle ; seul le
-- Worker (cle secrete) lit et ecrit. `fictif` marque les donnees de demo.
--
-- Rejouable : chaque instruction ne cree que ce qui n'existe pas encore.

create table if not exists commentaires (
  id            text primary key,
  "annonceId"   text not null references annonces (id) on delete cascade,
  "auteurId"    text not null references utilisateurs (id) on delete cascade,
  contenu       text not null check (char_length(contenu) between 1 and 500),
  reponse       jsonb,                    -- { contenu, creeLe, misAJourLe }, null sans reponse
  statut        text not null default 'visible' check (statut in ('visible', 'masque')),
  fictif        boolean not null default false,
  "creeLe"      timestamptz not null default now(),
  "misAJourLe"  timestamptz not null default now()
);

create index if not exists commentaires_annonce on commentaires ("annonceId", "creeLe");

alter table commentaires enable row level security;

revoke all on commentaires from anon, authenticated;
