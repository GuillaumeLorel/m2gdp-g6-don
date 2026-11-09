-- Messages non lus : un compteur sur l'onglet Messages (demande du 09/11/2026).
--
-- Chaque participant retient le moment ou il a lu la conversation pour la
-- derniere fois. Est non lu ce qui est arrive apres. Les conversations deja
-- la recoivent l'heure de la migration : leurs anciens messages comptent
-- comme lus, personne ne retrouve un compteur gonfle d'un coup.
--
-- Rejouable : chaque instruction ne cree que ce qui n'existe pas encore.

alter table conversations add column if not exists "luParOffrantLe" timestamptz not null default now();
alter table conversations add column if not exists "luParDemandeurLe" timestamptz not null default now();
