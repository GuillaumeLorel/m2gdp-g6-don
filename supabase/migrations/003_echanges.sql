-- Echanges entre membres (J4) : favoris, conversations, messages, reservations.
-- Voir specs/data-model.md, « Échanges entre membres » et « Réservation ».
--
-- Meme regime que les autres tables : RLS active, aucune regle ; seul le
-- Worker (cle secrete) lit et ecrit. `fictif` marque les donnees de demo.
--
-- Rejouable : chaque instruction ne cree que ce qui n'existe pas encore.

create table if not exists favoris (
  "utilisateurId" text not null references utilisateurs (id) on delete cascade,
  "annonceId"     text not null references annonces (id) on delete cascade,
  "creeLe"        timestamptz not null default now(),
  primary key ("utilisateurId", "annonceId")
);

-- Une conversation par couple (annonce, demandeur).
create table if not exists conversations (
  id             text primary key,
  "annonceId"    text not null references annonces (id) on delete cascade,
  "offrantId"    text not null references utilisateurs (id) on delete cascade,
  "demandeurId"  text not null references utilisateurs (id) on delete cascade,
  fictif         boolean not null default false,
  "creeLe"       timestamptz not null default now(),
  "misAJourLe"   timestamptz not null default now(),
  unique ("annonceId", "demandeurId")
);

create index if not exists conversations_offrant on conversations ("offrantId");
create index if not exists conversations_demandeur on conversations ("demandeurId");

-- Parcours retenu le 29/10/2026 : le demandeur demande, l'offrant valide
-- (l'objet lui est alors propose) ou decline, le demandeur paie en mode test.
create table if not exists reservations (
  id                        text primary key,
  "annonceId"               text not null references annonces (id) on delete cascade,
  "demandeurId"             text not null references utilisateurs (id) on delete cascade,
  "offrantId"               text not null references utilisateurs (id) on delete cascade,
  "conversationId"          text not null references conversations (id) on delete cascade,
  statut                    text not null default 'demandee'
                            check (statut in ('demandee', 'liste_attente', 'proposee', 'confirmee', 'remise', 'annulee')),
  "motifAnnulation"         text
                            check ("motifAnnulation" in ('desistement', 'refus', 'declinee', 'sans_reponse',
                                                         'attribuee_a_autrui', 'annonce_retiree')),
  "proposeeLe"              timestamptz,
  "participationDemandee"   numeric(8, 2),
  "statutPaiement"          text not null default 'en_attente'
                            check ("statutPaiement" in ('en_attente', 'paye', 'echoue', 'rembourse')),
  "referencePaiement"       text,            -- identifiant de transaction du prestataire (mode test)
  "sessionPaiement"         text,            -- session de paiement en cours, jamais exposee
  fictif                    boolean not null default false,
  "creeLe"                  timestamptz not null default now(),
  "misAJourLe"              timestamptz not null default now()
);

create index if not exists reservations_annonce on reservations ("annonceId");
create index if not exists reservations_demandeur on reservations ("demandeurId");
create index if not exists reservations_offrant on reservations ("offrantId");

create table if not exists messages (
  id                text primary key,
  "conversationId"  text not null references conversations (id) on delete cascade,
  type              text not null default 'utilisateur' check (type in ('utilisateur', 'systeme')),
  "auteurId"        text references utilisateurs (id) on delete set null, -- vide pour un message systeme
  "reservationId"   text references reservations (id) on delete set null,
  evenement         text,                    -- message systeme : demande_recue, objet_propose...
  contenu           text not null default '',
  fictif            boolean not null default false,
  "creeLe"          timestamptz not null default now()
);

create index if not exists messages_conversation on messages ("conversationId", "creeLe");

alter table favoris       enable row level security;
alter table conversations enable row level security;
alter table reservations  enable row level security;
alter table messages      enable row level security;

revoke all on favoris, conversations, reservations, messages from anon, authenticated;
