-- Schema des donnees Doneo sur Supabase (Postgres 17, region UE : eu-west-1).
--
-- Les colonnes gardent les noms des champs de l'API (camelCase, en francais) :
-- le Worker et le front lisent les memes noms qu'avec Firestore. D'ou les
-- guillemets autour des noms composes.
--
-- Rejouable : chaque instruction ne cree que ce qui n'existe pas encore.

create table if not exists utilisateurs (
  id                  text primary key,           -- identifiant du compte Supabase Auth (UUID)
  email               text,
  nom                 text not null,
  prenom              text not null,
  roles               text[] not null default '{}',
  "numeroRue"         text,                       -- 🔒 adresse exacte
  rue                 text,                       -- 🔒
  "complementAdresse" text default '',            -- 🔒
  "codePostal"        text,
  ville               text,
  "dateNaissance"     date,
  "photoUrl"          text default '',
  fictif              boolean not null default false, -- profils de demonstration
  "creeLe"            timestamptz not null default now(),
  "misAJourLe"        timestamptz not null default now()
);

create table if not exists categories (
  id                text primary key,
  libelle           text not null,
  "parentId"        text references categories (id) on delete cascade,
  ordre             integer not null default 0,
  icone             text,
  teinte            text,
  "illustrationUrl" text
);

create table if not exists associations (
  id           text primary key,
  nom          text not null,
  description  text,
  thematique   text,
  "numeroRna"  text,
  "codePostal" text,
  ville        text,
  "siteWeb"    text,
  "logoUrl"    text
);

create table if not exists annonces (
  id                   text primary key,
  "offrantId"          text not null references utilisateurs (id) on delete cascade,
  "associationId"      text references associations (id),
  "categorieId"        text references categories (id),
  "sousCategorieId"    text references categories (id),
  titre                text not null,
  description          text,
  etat                 text check (etat in ('neuf', 'tres_bon_etat', 'bon_etat', 'usage')),
  participation        numeric(8, 2) not null check (participation > 0),
  "creneauRetrait"     jsonb,                      -- { debut, fin } en ISO 8601
  "numeroRue"          text,                       -- 🔒 adresse exacte
  rue                  text,                       -- 🔒
  "complementAdresse"  text default '',            -- 🔒
  "codePostal"         text,
  ville                text,
  latitude             double precision,           -- 🔒 position exacte
  longitude            double precision,           -- 🔒
  "latitudeApprochee"  double precision,           -- publique (decalee de 200 a 500 m)
  "longitudeApprochee" double precision,
  quartier             text,
  "mediaIds"           text[] not null default '{}',
  statut               text not null default 'disponible'
                       check (statut in ('disponible', 'reserve', 'remis', 'retiree')),
  "assisteeParIA"      boolean not null default false,
  fictif               boolean not null default false,
  "creeLe"             timestamptz not null default now(),
  "misAJourLe"         timestamptz not null default now()
);

create index if not exists annonces_statut on annonces (statut);
create index if not exists annonces_offrant on annonces ("offrantId");

-- Securite : Row Level Security activee SANS aucune regle d'acces. Les cles
-- publiques (anon, publishable) ne voient donc rien ; seul le Worker, avec la
-- cle secrete, lit et ecrit. Le navigateur ne touche jamais la base
-- directement — c'est ce qui garde l'adresse exacte hors de sa portee.
alter table utilisateurs enable row level security;
alter table categories   enable row level security;
alter table associations enable row level security;
alter table annonces     enable row level security;

revoke all on utilisateurs, categories, associations, annonces from anon, authenticated;
