-- Sales : import automatique de prospects depuis Google Agenda.
-- L'utilisateur « éduque » le CRM avec ses formats de titre de RDV
-- (ex. « Diagnostic Closing 1:1 — [Nom complet] × Thomas »). Tout RDV dont le
-- titre correspond (ou, en option, dont un invité est externe) et dont la
-- personne est absente du CRM crée un prospect au stade « qualified ».
-- L'import tourne côté serveur (cron /api/cron/sales-gcal-import, toutes les
-- 15 min) grâce à un refresh token Google : il fonctionne même app fermée.

create table if not exists public.sales_gcal_import_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- [{ id, template, offer_id }]
  rules jsonb not null default '[]'::jsonb,
  -- Sur un RDV reconnu par titre, compléter l'email/nom avec l'invité externe
  use_invitees boolean not null default true,
  -- Créer aussi un prospect pour l'invité externe de n'importe quel RDV (sans titre reconnu)
  import_all_invitees boolean not null default false,
  -- Emails jamais considérés comme prospects (setters, collègues, assistants…)
  ignored_emails text[] not null default '{}',
  -- Clés « eventId|identité » déjà traitées : un prospect supprimé n'est pas recréé
  processed_keys text[] not null default '{}',
  -- État de la dernière synchro (écrit par le serveur)
  last_synced_at timestamptz,
  last_sync_error text,
  last_created_count integer not null default 0,
  -- Verrou anti-doublon entre le cron et une synchro manuelle
  sync_lock_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sales_gcal_import_settings enable row level security;

create policy "sales_gcal_import_select_own" on public.sales_gcal_import_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sales_gcal_import_insert_own" on public.sales_gcal_import_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "sales_gcal_import_update_own" on public.sales_gcal_import_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Jetons Google Agenda des utilisateurs Sales (flux auth-code → refresh token).
-- Lus/écrits uniquement par le serveur (service role) : aucune policy.
create table if not exists public.sales_google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text not null,
  expires_at timestamptz,
  scope text,
  google_email text,
  updated_at timestamptz not null default now()
);

alter table public.sales_google_calendar_tokens enable row level security;
revoke all on public.sales_google_calendar_tokens from anon, authenticated;
