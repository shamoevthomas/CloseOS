-- Sales : relier les rendez-vous (meetings) aux prospects et aux événements Google Agenda.
-- prospect_id     : RDV d'un prospect (fiche prospect → « Prochain RDV »). Auparavant le
--                   front lisait une colonne inexistante (prospectId) : le lien n'était jamais stocké.
-- google_event_id : RDV créé par l'import Google Agenda (id « google-<eventId> », même format
--                   que le front) — sert à le tenir à jour et à ne pas l'afficher en double.

alter table public.meetings
  add column if not exists prospect_id bigint references public.prospects(id) on delete set null,
  add column if not exists google_event_id text;

create index if not exists meetings_prospect_id_idx on public.meetings (prospect_id) where prospect_id is not null;
create unique index if not exists meetings_user_google_event_uniq on public.meetings (user_id, google_event_id) where google_event_id is not null;
