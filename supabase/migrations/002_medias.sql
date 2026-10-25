-- Photos des annonces : fichiers dans Supabase Storage (bucket `medias`,
-- region UE), auteur et caracteristiques dans la table `medias`.
--
-- Le bucket est PUBLIC EN LECTURE : une photo d'annonce se montre a tous,
-- comme l'annonce elle-meme, et le navigateur la charge directement depuis
-- Supabase. Aucune regle d'ecriture : seul le Worker, avec la cle secrete,
-- televerse et supprime. Le nom du fichier est un UUID, impossible a deviner.
--
-- Rejouable : chaque instruction ne cree que ce qui n'existe pas encore.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medias', 'medias', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists medias (
  id               text primary key,             -- UUID, aussi nom du fichier dans le bucket
  "proprietaireId" text not null references utilisateurs (id) on delete cascade,
  "typeMime"       text not null,
  "tailleOctets"   integer not null,
  "creeLe"         timestamptz not null default now()
);

create index if not exists medias_proprietaire on medias ("proprietaireId");

-- Meme regime que les autres tables : RLS active, aucune regle.
alter table medias enable row level security;
revoke all on medias from anon, authenticated;
