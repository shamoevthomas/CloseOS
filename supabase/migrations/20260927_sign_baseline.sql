set client_min_messages = warning;
-- CloseOS Sign — état de référence du schéma (tables, contraintes, index, RLS, triggers, fonctions).
-- Reconstitué le 27/09/2026 depuis la base de production (projet qwjvdwpixewsctircibl) : ces objets
-- avaient été créés à la main et n'étaient pas versionnés. Fichier IDEMPOTENT : il ne modifie rien
-- sur une base déjà à jour (create if not exists / create or replace / policies recréées à l'identique).
-- Les correctifs de sécurité sont dans la migration suivante, pas ici.

-- ───────────────────────────── Tables ─────────────────────────────

create table if not exists public.sign_users (
  id uuid default gen_random_uuid() not null,
  email text not null,
  full_name text,
  phone text,
  company text,
  avatar_url text,
  has_onboarded boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  address text,
  city text,
  siret text,
  siren text,
  tva text,
  company_id text,
  ape text,
  stripe_account_id text,
  stripe_connected boolean default false not null,
  notif_prefs jsonb default '{}'::jsonb not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_cycle text,
  current_period_end timestamp with time zone,
  subscription_exempt boolean default false not null,
  subscription_past_due_at timestamp with time zone,
  subscription_dunning_sent text[] default '{}'::text[] not null,
  mcp_key text,
  has_seen_v5_popup boolean default true not null,
  constraint sign_users_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_contact_groups (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  color text,
  created_at timestamp with time zone default now() not null,
  constraint sign_contact_groups_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_contacts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  email text not null,
  phone text,
  company text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  address text,
  city text,
  details jsonb default '{}'::jsonb not null,
  siret text,
  siren text,
  tva text,
  company_id text,
  ape text,
  group_id uuid,
  constraint sign_contacts_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_contract_folders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  parent_id uuid,
  created_at timestamp with time zone default now() not null,
  constraint sign_contract_folders_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_team_members (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  user_id uuid,
  business_team_member_id uuid,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  status text default 'invited'::text not null,
  source text default 'invite'::text not null,
  created_at timestamp with time zone default now() not null,
  joined_at timestamp with time zone,
  constraint sign_team_members_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_contracts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  contact_id uuid,
  title text default 'Contrat sans titre'::text not null,
  content_html text,
  status text default 'draft'::text not null,
  deposit_amount integer,
  currency text default 'eur'::text not null,
  document_hash text,
  access_token text,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  signed_at timestamp with time zone,
  paid_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  source_type text default 'text'::text not null,
  pdf_data text,
  page_count integer default 1 not null,
  locked boolean default false not null,
  owner_email text,
  images jsonb default '[]'::jsonb not null,
  theme text default 'blank'::text not null,
  inline_values jsonb default '{}'::jsonb not null,
  verification_method text default 'none'::text not null,
  verification_email text,
  verification_emails text[] default '{}'::text[] not null,
  verification_phones text[] default '{}'::text[] not null,
  verification_pairs jsonb default '[]'::jsonb not null,
  verification_locked boolean default false not null,
  verification_lock_reason text,
  verification_lock_step integer,
  verification_dest_attempts integer default 0 not null,
  verification_code_attempts integer default 0 not null,
  verification_locked_at timestamp with time zone,
  payment_mode text,
  payment_amount integer,
  payment_interval text,
  payment_duration_months integer,
  payment_trial_days integer default 0 not null,
  payment_tva_rate numeric,
  payment_status text default 'none'::text not null,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  signer_count integer default 1 not null,
  signing_order text default 'parallel'::text not null,
  payment_enabled boolean default false not null,
  sealed_hash text,
  certificate_hash text,
  certificate_path text,
  certificate_id uuid,
  certified_at timestamp with time zone,
  purge_hold boolean default false not null,
  is_template boolean default false not null,
  template_id uuid,
  rep_id uuid,
  last_reminder_at timestamp with time zone,
  reminder_started_at timestamp with time zone,
  folder_id uuid,
  team_member_id uuid,
  constraint sign_contracts_pkey PRIMARY KEY (id),
  constraint sign_contracts_signing_order_check CHECK ((signing_order = ANY (ARRAY['parallel'::text, 'sequential'::text]))),
  constraint sign_contracts_source_type_check CHECK ((source_type = ANY (ARRAY['text'::text, 'pdf'::text]))),
  constraint sign_contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'sent'::text, 'viewed'::text, 'signed'::text, 'paid'::text, 'declined'::text, 'expired'::text, 'cancelled'::text]))),
  constraint sign_contracts_verification_method_check CHECK ((verification_method = ANY (ARRAY['none'::text, 'email'::text, 'sms'::text, 'email_sms'::text, 'pay'::text])))
);

create table if not exists public.sign_contract_fields (
  id uuid default gen_random_uuid() not null,
  contract_id uuid not null,
  field_type text not null,
  placement text default 'free'::text not null,
  page integer default 1 not null,
  pos_x numeric,
  pos_y numeric,
  required boolean default true not null,
  value text,
  filled_at timestamp with time zone,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  width numeric,
  height numeric,
  assignee text default 'signer'::text not null,
  tz_offset integer,
  label text,
  signer_index integer,
  constraint sign_contract_fields_pkey PRIMARY KEY (id),
  constraint sign_contract_fields_assignee_check CHECK ((assignee = ANY (ARRAY['owner'::text, 'signer'::text]))),
  constraint sign_contract_fields_field_type_check CHECK ((field_type = ANY (ARRAY['signature'::text, 'initials'::text, 'name'::text, 'firstname'::text, 'lastname'::text, 'date'::text, 'time'::text, 'email'::text, 'tel'::text, 'address'::text, 'city'::text, 'siret'::text, 'siren'::text, 'tva'::text, 'company_id'::text, 'ape'::text, 'checkbox'::text, 'text'::text]))),
  constraint sign_contract_fields_placement_check CHECK ((placement = ANY (ARRAY['inline'::text, 'free'::text])))
);

create table if not exists public.sign_contract_signers (
  id uuid default gen_random_uuid() not null,
  contract_id uuid not null,
  signer_index integer not null,
  contact_id uuid,
  name text,
  email text,
  phone text,
  access_token text,
  status text default 'pending'::text not null,
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  signed_at timestamp with time zone,
  paid_at timestamp with time zone,
  inline_values jsonb default '{}'::jsonb not null,
  verification_emails jsonb default '[]'::jsonb not null,
  verification_phones jsonb default '[]'::jsonb not null,
  verification_pairs jsonb default '[]'::jsonb not null,
  verification_locked boolean default false not null,
  verification_lock_reason text,
  verification_lock_step integer,
  verification_dest_attempts integer default 0 not null,
  verification_code_attempts integer default 0 not null,
  payment_required boolean default false not null,
  payment_status text default 'none'::text not null,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  subscription_status text,
  last_payment_at timestamp with time zone,
  last_payment_status text,
  constraint sign_contract_signers_access_token_key UNIQUE (access_token),
  constraint sign_contract_signers_contract_id_signer_index_key UNIQUE (contract_id, signer_index),
  constraint sign_contract_signers_pkey PRIMARY KEY (id),
  constraint sign_signers_payment_status_check CHECK ((payment_status = ANY (ARRAY['none'::text, 'pending'::text, 'paid'::text]))),
  constraint sign_signers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'opened'::text, 'signed'::text, 'declined'::text])))
);

create table if not exists public.sign_signature_events (
  id uuid default gen_random_uuid() not null,
  contract_id uuid not null,
  contact_id uuid,
  event_type text not null,
  email text,
  ip_address inet,
  user_agent text,
  document_hash text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_signature_events_pkey PRIMARY KEY (id),
  constraint sign_signature_events_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'sent'::text, 'opened'::text, 'otp_sent'::text, 'otp_verified'::text, 'signed'::text, 'paid'::text, 'declined'::text, 'downloaded'::text, 'consent'::text, 'email_access'::text, 'sealed'::text, 'completed'::text, 'certified'::text, 'security'::text, 'reminder'::text])))
);

create table if not exists public.sign_verification_codes (
  id uuid default gen_random_uuid() not null,
  contract_id uuid not null,
  email text not null,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  attempts integer default 0 not null,
  consumed boolean default false not null,
  created_at timestamp with time zone default now() not null,
  channel text default 'email'::text not null,
  signer_index integer,
  constraint sign_verification_codes_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_otp_codes (
  id uuid default gen_random_uuid() not null,
  contract_id uuid not null,
  phone text not null,
  code text not null,
  attempts integer default 0 not null,
  verified boolean default false not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_otp_codes_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_subscription_events (
  id uuid default gen_random_uuid() not null,
  stripe_event_id text not null,
  contract_id uuid,
  signer_id uuid,
  subscription_id text,
  payment_intent_id text,
  invoice_id text,
  type text not null,
  billing_reason text,
  amount_cents integer,
  currency text,
  commission_cents integer,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  occurred_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_subscription_events_stripe_event_id_key UNIQUE (stripe_event_id),
  constraint sign_subscription_events_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_webhook_events (
  stripe_event_id text not null,
  type text,
  object_id text,
  matched boolean default false not null,
  note text,
  payload jsonb,
  created_at timestamp with time zone default now() not null,
  constraint sign_webhook_events_pkey PRIMARY KEY (stripe_event_id)
);

create table if not exists public.sign_device_codes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  code text not null,
  expires_at timestamp with time zone not null,
  used boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_device_codes_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_device_tokens (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  device_fingerprint text not null,
  token text not null,
  revoke_token text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  device_name text,
  last_ip text,
  location text,
  constraint sign_device_tokens_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_login_codes (
  id uuid default gen_random_uuid() not null,
  email text not null,
  code text not null,
  attempts integer default 0 not null,
  verified boolean default false not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_login_codes_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_owner_sign_sessions (
  id uuid default gen_random_uuid() not null,
  token text not null,
  owner_id uuid not null,
  owner_email text not null,
  contract_ids uuid[] default '{}'::uuid[] not null,
  code_hash text,
  code_expires_at timestamp with time zone,
  code_attempts integer default 0 not null,
  verified boolean default false not null,
  signature_value text,
  signature_kind text,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '00:30:00'::interval) not null,
  constraint sign_owner_sign_sessions_token_key UNIQUE (token),
  constraint sign_owner_sign_sessions_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_template_reps (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  user_id uuid not null,
  label text not null,
  email text not null,
  access_token text not null,
  status text default 'active'::text not null,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint sign_template_reps_access_token_key UNIQUE (access_token),
  constraint sign_template_reps_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_rep_codes (
  id uuid default gen_random_uuid() not null,
  rep_id uuid not null,
  code text not null,
  expires_at timestamp with time zone not null,
  used boolean default false not null,
  attempts integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_rep_codes_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_rep_devices (
  id uuid default gen_random_uuid() not null,
  rep_id uuid not null,
  device_fingerprint text not null,
  token text not null,
  expires_at timestamp with time zone not null,
  device_name text,
  last_ip text,
  created_at timestamp with time zone default now() not null,
  constraint sign_rep_devices_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_secrets (
  name text not null,
  value text not null,
  updated_at timestamp with time zone default now() not null,
  constraint sign_secrets_pkey PRIMARY KEY (name)
);

create table if not exists public.sign_team_invites (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  token text not null,
  email text,
  first_name text,
  expires_at timestamp with time zone default (now() + '14 days'::interval) not null,
  accepted_at timestamp with time zone,
  accepted_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint sign_team_invites_token_key UNIQUE (token),
  constraint sign_team_invites_pkey PRIMARY KEY (id)
);

create table if not exists public.sign_template_members (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  team_member_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_template_members_template_id_team_member_id_key UNIQUE (template_id, team_member_id),
  constraint sign_template_members_pkey PRIMARY KEY (id)
);

-- ───────────────────────────── Clés étrangères ─────────────────────────────
-- Ajoutées seulement si absentes (le nom de contrainte fait foi).

do $$
declare fk record;
begin
  for fk in select * from (values
    ('sign_contact_groups', 'sign_contact_groups_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('sign_contacts', 'sign_contacts_group_id_fkey', 'FOREIGN KEY (group_id) REFERENCES sign_contact_groups(id) ON DELETE SET NULL'),
    ('sign_contacts', 'sign_contacts_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES sign_users(id) ON DELETE CASCADE'),
    ('sign_contract_fields', 'sign_contract_fields_contract_id_fkey', 'FOREIGN KEY (contract_id) REFERENCES sign_contracts(id) ON DELETE CASCADE'),
    ('sign_contract_folders', 'sign_contract_folders_parent_id_fkey', 'FOREIGN KEY (parent_id) REFERENCES sign_contract_folders(id) ON DELETE SET NULL'),
    ('sign_contract_signers', 'sign_contract_signers_contact_id_fkey', 'FOREIGN KEY (contact_id) REFERENCES sign_contacts(id) ON DELETE SET NULL'),
    ('sign_contract_signers', 'sign_contract_signers_contract_id_fkey', 'FOREIGN KEY (contract_id) REFERENCES sign_contracts(id) ON DELETE CASCADE'),
    ('sign_contracts', 'sign_contracts_contact_id_fkey', 'FOREIGN KEY (contact_id) REFERENCES sign_contacts(id) ON DELETE SET NULL'),
    ('sign_contracts', 'sign_contracts_folder_id_fkey', 'FOREIGN KEY (folder_id) REFERENCES sign_contract_folders(id) ON DELETE SET NULL'),
    ('sign_contracts', 'sign_contracts_rep_id_fkey', 'FOREIGN KEY (rep_id) REFERENCES sign_template_reps(id) ON DELETE SET NULL'),
    ('sign_contracts', 'sign_contracts_team_member_id_fkey', 'FOREIGN KEY (team_member_id) REFERENCES sign_team_members(id) ON DELETE SET NULL'),
    ('sign_contracts', 'sign_contracts_template_id_fkey', 'FOREIGN KEY (template_id) REFERENCES sign_contracts(id) ON DELETE SET NULL'),
    ('sign_contracts', 'sign_contracts_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES sign_users(id) ON DELETE CASCADE'),
    ('sign_device_codes', 'sign_device_codes_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('sign_device_tokens', 'sign_device_tokens_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('sign_otp_codes', 'sign_otp_codes_contract_id_fkey', 'FOREIGN KEY (contract_id) REFERENCES sign_contracts(id) ON DELETE CASCADE'),
    ('sign_rep_codes', 'sign_rep_codes_rep_id_fkey', 'FOREIGN KEY (rep_id) REFERENCES sign_template_reps(id) ON DELETE CASCADE'),
    ('sign_rep_devices', 'sign_rep_devices_rep_id_fkey', 'FOREIGN KEY (rep_id) REFERENCES sign_template_reps(id) ON DELETE CASCADE'),
    ('sign_signature_events', 'sign_signature_events_contact_id_fkey', 'FOREIGN KEY (contact_id) REFERENCES sign_contacts(id) ON DELETE SET NULL'),
    ('sign_signature_events', 'sign_signature_events_contract_id_fkey', 'FOREIGN KEY (contract_id) REFERENCES sign_contracts(id) ON DELETE CASCADE'),
    ('sign_subscription_events', 'sign_subscription_events_contract_id_fkey', 'FOREIGN KEY (contract_id) REFERENCES sign_contracts(id) ON DELETE CASCADE'),
    ('sign_subscription_events', 'sign_subscription_events_signer_id_fkey', 'FOREIGN KEY (signer_id) REFERENCES sign_contract_signers(id) ON DELETE SET NULL'),
    ('sign_team_invites', 'sign_team_invites_accepted_by_fkey', 'FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL'),
    ('sign_team_invites', 'sign_team_invites_owner_id_fkey', 'FOREIGN KEY (owner_id) REFERENCES sign_users(id) ON DELETE CASCADE'),
    ('sign_team_members', 'sign_team_members_business_team_member_id_fkey', 'FOREIGN KEY (business_team_member_id) REFERENCES business_team_members(id) ON DELETE SET NULL'),
    ('sign_team_members', 'sign_team_members_owner_id_fkey', 'FOREIGN KEY (owner_id) REFERENCES sign_users(id) ON DELETE CASCADE'),
    ('sign_team_members', 'sign_team_members_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL'),
    ('sign_template_members', 'sign_template_members_team_member_id_fkey', 'FOREIGN KEY (team_member_id) REFERENCES sign_team_members(id) ON DELETE CASCADE'),
    ('sign_template_members', 'sign_template_members_template_id_fkey', 'FOREIGN KEY (template_id) REFERENCES sign_contracts(id) ON DELETE CASCADE'),
    ('sign_template_reps', 'sign_template_reps_template_id_fkey', 'FOREIGN KEY (template_id) REFERENCES sign_contracts(id) ON DELETE CASCADE'),
    ('sign_template_reps', 'sign_template_reps_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES sign_users(id) ON DELETE CASCADE'),
    ('sign_users', 'sign_users_id_auth_fk', 'FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('sign_verification_codes', 'sign_verification_codes_contract_id_fkey', 'FOREIGN KEY (contract_id) REFERENCES sign_contracts(id) ON DELETE CASCADE')
  ) as v(tbl, name, def)
  loop
    if not exists (select 1 from pg_constraint where conname = fk.name) then
      execute format('alter table public.%I add constraint %I %s', fk.tbl, fk.name, fk.def);
    end if;
  end loop;
end $$;

-- ───────────────────────────── Index ─────────────────────────────

create index if not exists idx_sign_contact_groups_user on public.sign_contact_groups using btree (user_id);
create index if not exists idx_sign_contacts_group on public.sign_contacts using btree (group_id);
create index if not exists sign_contacts_user_idx on public.sign_contacts using btree (user_id);
create index if not exists sign_contract_fields_contract_idx on public.sign_contract_fields using btree (contract_id);
create index if not exists idx_sign_contract_folders_parent on public.sign_contract_folders using btree (parent_id);
create index if not exists idx_sign_contract_folders_user on public.sign_contract_folders using btree (user_id);
create index if not exists idx_sign_signers_contract on public.sign_contract_signers using btree (contract_id);
create index if not exists idx_sign_signers_token on public.sign_contract_signers using btree (access_token);
create index if not exists idx_sign_contracts_folder on public.sign_contracts using btree (folder_id);
create index if not exists idx_sign_contracts_rep on public.sign_contracts using btree (rep_id) where (rep_id is not null);
create index if not exists idx_sign_contracts_template on public.sign_contracts using btree (template_id) where (template_id is not null);
create index if not exists idx_sign_contracts_user_tpl on public.sign_contracts using btree (user_id, is_template);
create unique index if not exists sign_contracts_access_token_uniq on public.sign_contracts using btree (access_token) where (access_token is not null);
create index if not exists sign_contracts_status_idx on public.sign_contracts using btree (status);
create index if not exists sign_contracts_team_member_idx on public.sign_contracts using btree (team_member_id);
create index if not exists sign_contracts_user_idx on public.sign_contracts using btree (user_id);
create index if not exists idx_sign_device_codes_user on public.sign_device_codes using btree (user_id, used);
create index if not exists idx_sign_device_tokens_lookup on public.sign_device_tokens using btree (user_id, device_fingerprint);
create index if not exists idx_sign_device_tokens_revoke on public.sign_device_tokens using btree (revoke_token);
create index if not exists idx_sign_device_tokens_token on public.sign_device_tokens using btree (token);
create index if not exists sign_login_codes_email_idx on public.sign_login_codes using btree (lower(email));
create index if not exists sign_otp_codes_contract_idx on public.sign_otp_codes using btree (contract_id);
create index if not exists idx_owner_sign_sessions_token on public.sign_owner_sign_sessions using btree (token);
create index if not exists idx_sign_rep_codes_rep on public.sign_rep_codes using btree (rep_id);
create index if not exists idx_sign_rep_devices_rep on public.sign_rep_devices using btree (rep_id);
create index if not exists idx_sign_rep_devices_token on public.sign_rep_devices using btree (token);
create index if not exists sign_signature_events_contract_idx on public.sign_signature_events using btree (contract_id);
create index if not exists idx_sign_sub_events_contract on public.sign_subscription_events using btree (contract_id);
create index if not exists idx_sign_sub_events_occurred on public.sign_subscription_events using btree (occurred_at);
create index if not exists idx_sign_sub_events_sub on public.sign_subscription_events using btree (subscription_id);
create unique index if not exists sign_team_members_owner_email_idx on public.sign_team_members using btree (owner_id, lower(email));
create unique index if not exists sign_team_members_owner_user_idx on public.sign_team_members using btree (owner_id, user_id) where (user_id is not null);
create index if not exists sign_team_members_user_idx on public.sign_team_members using btree (user_id);
create index if not exists idx_sign_reps_template on public.sign_template_reps using btree (template_id);
create index if not exists idx_sign_reps_token on public.sign_template_reps using btree (access_token);
create index if not exists idx_sign_users_stripe_cust on public.sign_users using btree (stripe_customer_id);
create index if not exists idx_sign_users_stripe_sub on public.sign_users using btree (stripe_subscription_id);
create unique index if not exists sign_users_email_lower_uniq on public.sign_users using btree (lower(email));
create unique index if not exists sign_users_mcp_key_idx on public.sign_users using btree (mcp_key) where (mcp_key is not null);
create index if not exists sign_verification_codes_contract_idx on public.sign_verification_codes using btree (contract_id, created_at desc);

-- ───────────────────────────── Fonctions ─────────────────────────────

CREATE OR REPLACE FUNCTION public.sign_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sign_content_hash(p_source text, p_pdf text, p_html text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select encode(digest(case when p_source = 'pdf' then coalesce(p_pdf,'') else coalesce(p_html,'') end, 'sha256'), 'hex');
$function$;

CREATE OR REPLACE FUNCTION public.sign_enforce_account_separation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if exists (select 1 from public.profiles p where p.id = NEW.id)
     and not exists (select 1 from public.business_users b where b.id = NEW.id) then
    raise exception 'Cet email possède un compte CloseOS Sales (sans Business) et ne peut pas avoir de compte Sign (%).', NEW.email
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sign_cert_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare jwt_role text;
begin
  jwt_role := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  if jwt_role in ('anon','authenticated') then
    if NEW.sealed_hash is distinct from OLD.sealed_hash
       or NEW.certificate_hash is distinct from OLD.certificate_hash
       or NEW.certificate_path is distinct from OLD.certificate_path
       or NEW.certificate_id is distinct from OLD.certificate_id
       or NEW.certified_at is distinct from OLD.certified_at then
      raise exception 'certificate fields are server-only' using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sign_guard_signing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  IF jwt_role IN ('anon', 'authenticated') THEN
    IF (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')
       OR (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed' AND COALESCE(NEW.verification_method, 'none') <> 'none') THEN
      RAISE EXCEPTION 'signing requires server verification'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sign_signers_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare jwt_role text;
begin
  jwt_role := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  if jwt_role in ('anon','authenticated') then
    if (new.status = 'signed' and old.status is distinct from 'signed')
       or (new.payment_status = 'paid' and old.payment_status is distinct from 'paid') then
      raise exception 'signing requires server verification' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sign_events_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare jwt_role text;
begin
  jwt_role := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  if jwt_role in ('anon','authenticated') then
    -- Suppression en cascade depuis la suppression du contrat parent : autorisée.
    if tg_op = 'DELETE' and not exists (select 1 from sign_contracts where id = old.contract_id) then
      return old;
    end if;
    raise exception 'signature events are append-only' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sign_owns_template(p_template_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$ select exists (select 1 from sign_contracts where id = p_template_id and user_id = auth.uid() and is_template = true); $function$;

CREATE OR REPLACE FUNCTION public.sign_generate_mcp_key()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text;
begin
  if not exists (select 1 from sign_users where id = auth.uid()) then raise exception 'pas_owner_sign'; end if;
  v_key := 'sk_' || encode(gen_random_bytes(24), 'hex');
  update sign_users set mcp_key = v_key where id = auth.uid();
  return v_key;
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_get_mcp_key()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$ select mcp_key from sign_users where id = auth.uid(); $function$;

CREATE OR REPLACE FUNCTION public.sign_revoke_mcp_key()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  update sign_users set mcp_key = null where id = auth.uid();
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_accept_team_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_inv sign_team_invites%rowtype; v_uid uuid := auth.uid(); v_email text; v_member_id uuid;
begin
  if v_uid is null then raise exception 'non_connecte'; end if;
  select * into v_inv from sign_team_invites where token = p_token for update;
  if v_inv.id is null then raise exception 'introuvable'; end if;
  if v_inv.accepted_at is not null then raise exception 'deja_utilisee'; end if;
  if v_inv.expires_at < now() then raise exception 'expiree'; end if;
  select email into v_email from auth.users where id = v_uid;

  insert into sign_team_members (owner_id, user_id, email, first_name, status, source, joined_at)
  values (v_inv.owner_id, v_uid, coalesce(v_inv.email, v_email), v_inv.first_name, 'active', 'invite', now())
  on conflict (owner_id, lower(email)) do update set user_id = excluded.user_id, status = 'active', joined_at = now()
  returning id into v_member_id;

  update sign_team_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return jsonb_build_object('ok', true, 'member_id', v_member_id, 'owner_id', v_inv.owner_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_invite_info(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_inv sign_team_invites%rowtype; v_owner text;
begin
  select * into v_inv from sign_team_invites where token = p_token;
  if v_inv.id is null then return jsonb_build_object('valid', false, 'reason', 'introuvable'); end if;
  if v_inv.accepted_at is not null then return jsonb_build_object('valid', false, 'reason', 'deja_utilisee'); end if;
  if v_inv.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'expiree'); end if;
  select coalesce(full_name, company, email) into v_owner from sign_users where id = v_inv.owner_id;
  return jsonb_build_object('valid', true, 'owner_name', v_owner, 'email', v_inv.email, 'first_name', v_inv.first_name);
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_sync_business_team()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_uid uuid := auth.uid(); v_count integer := 0;
begin
  if v_uid is null then raise exception 'non_connecte'; end if;
  if not exists (select 1 from sign_users where id = v_uid) then raise exception 'pas_owner_sign'; end if;

  insert into sign_team_members (owner_id, user_id, business_team_member_id, email, first_name, last_name, phone, status, source, joined_at)
  select v_uid, btm.user_id, btm.id, btm.email, btm.first_name, btm.last_name, btm.phone, 'active', 'business', now()
  from business_team_members btm
  where btm.business_owner_id = v_uid and btm.email is not null
  on conflict (owner_id, lower(email)) do update
    set user_id = coalesce(excluded.user_id, sign_team_members.user_id),
        business_team_member_id = excluded.business_team_member_id,
        first_name = coalesce(sign_team_members.first_name, excluded.first_name),
        last_name = coalesce(sign_team_members.last_name, excluded.last_name),
        status = case when sign_team_members.status = 'revoked' then 'revoked' else 'active' end;
  get diagnostics v_count = row_count;
  return v_count;
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_clone_template_to_instance(p_template_id uuid, p_rep_id uuid, p_signer_name text, p_signer_email text, p_signer_phone text, p_expires_days integer DEFAULT 7)
 RETURNS TABLE(instance_id uuid, signer_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_tpl sign_contracts%rowtype;
  v_owner_email text;
  v_instance uuid;
  v_token text;
  v_email text := nullif(btrim(lower(coalesce(p_signer_email,''))), '');
  v_phone text := nullif(btrim(coalesce(p_signer_phone,'')), '');
begin
  select * into v_tpl from sign_contracts where id = p_template_id and is_template = true;
  if not found then raise exception 'template_introuvable'; end if;
  if p_rep_id is not null then
    perform 1 from sign_template_reps where id = p_rep_id and template_id = p_template_id and status = 'active';
    if not found then raise exception 'rep_invalide_ou_revoque'; end if;
  end if;
  select email into v_owner_email from sign_users where id = v_tpl.user_id;
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');

  insert into sign_contracts (
    user_id, title, content_html, source_type, pdf_data, page_count, theme, images,
    inline_values, signer_count, signing_order, owner_email,
    verification_method, verification_emails, verification_phones, verification_pairs,
    payment_enabled, payment_mode, payment_amount, payment_interval, payment_duration_months, payment_trial_days, payment_tva_rate,
    status, is_template, template_id, rep_id, expires_at, document_hash, sent_at
  ) values (
    v_tpl.user_id, v_tpl.title, v_tpl.content_html, v_tpl.source_type, v_tpl.pdf_data, v_tpl.page_count, v_tpl.theme, v_tpl.images,
    v_tpl.inline_values, 1, 'parallel', v_owner_email,
    v_tpl.verification_method, '{}', '{}', '[]'::jsonb,
    v_tpl.payment_enabled, v_tpl.payment_mode, v_tpl.payment_amount, v_tpl.payment_interval, v_tpl.payment_duration_months, v_tpl.payment_trial_days, v_tpl.payment_tva_rate,
    'sent', false, p_template_id, p_rep_id, now() + (p_expires_days || ' days')::interval,
    sign_content_hash(v_tpl.source_type, v_tpl.pdf_data, v_tpl.content_html), now()
  ) returning id into v_instance;

  insert into sign_contract_fields (contract_id, field_type, placement, page, pos_x, pos_y, width, height, required, label, assignee, signer_index, sort_order, value, filled_at, tz_offset)
  select v_instance, field_type, placement, page, pos_x, pos_y, width, height, required, label, assignee, signer_index, sort_order,
         case when assignee = 'owner' then value     else null end,
         case when assignee = 'owner' then filled_at else null end,
         case when assignee = 'owner' then tz_offset else null end
  from sign_contract_fields where contract_id = p_template_id;

  insert into sign_contract_signers (
    contract_id, signer_index, name, email, phone, access_token, status, sent_at,
    verification_emails, verification_phones, verification_pairs, payment_required
  ) values (
    v_instance, 1, nullif(btrim(coalesce(p_signer_name,'')),''), v_email, v_phone, v_token, 'sent', now(),
    case when v_tpl.verification_method in ('email','email_sms') and v_email is not null then to_jsonb(array[v_email]) else '[]'::jsonb end,
    case when v_tpl.verification_method in ('sms','email_sms') and v_phone is not null then to_jsonb(array[v_phone]) else '[]'::jsonb end,
    case when v_tpl.verification_method = 'email_sms' and v_email is not null and v_phone is not null then jsonb_build_array(jsonb_build_object('email', v_email, 'phone', v_phone)) else '[]'::jsonb end,
    coalesce(v_tpl.payment_enabled, false)
  );

  instance_id := v_instance; signer_token := v_token; return next;
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_regenerate_instance_internal(p_instance_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_inst sign_contracts%rowtype; v_tpl sign_contracts%rowtype; v_token text;
begin
  select * into v_inst from sign_contracts where id = p_instance_id and is_template = false and template_id is not null;
  if not found then raise exception 'instance_introuvable'; end if;
  if v_inst.status in ('signed','paid') then raise exception 'instance_signee'; end if;
  select * into v_tpl from sign_contracts where id = v_inst.template_id;
  if not found then raise exception 'template_introuvable'; end if;
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');

  update sign_contracts set
    content_html = v_tpl.content_html, source_type = v_tpl.source_type, pdf_data = v_tpl.pdf_data,
    page_count = v_tpl.page_count, theme = v_tpl.theme, images = v_tpl.images, inline_values = v_tpl.inline_values,
    verification_method = v_tpl.verification_method,
    payment_enabled = v_tpl.payment_enabled, payment_mode = v_tpl.payment_mode, payment_amount = v_tpl.payment_amount,
    payment_interval = v_tpl.payment_interval, payment_duration_months = v_tpl.payment_duration_months,
    payment_trial_days = v_tpl.payment_trial_days, payment_tva_rate = v_tpl.payment_tva_rate,
    document_hash = sign_content_hash(v_tpl.source_type, v_tpl.pdf_data, v_tpl.content_html),
    status = 'sent', expires_at = now() + interval '7 days', sent_at = now(), viewed_at = null, signed_at = null, paid_at = null,
    payment_status = 'none', updated_at = now()
  where id = p_instance_id;

  delete from sign_contract_fields where contract_id = p_instance_id;
  insert into sign_contract_fields (contract_id, field_type, placement, page, pos_x, pos_y, width, height, required, label, assignee, signer_index, sort_order, value, filled_at, tz_offset)
  select p_instance_id, field_type, placement, page, pos_x, pos_y, width, height, required, label, assignee, signer_index, sort_order,
         case when assignee = 'owner' then value     else null end,
         case when assignee = 'owner' then filled_at else null end,
         case when assignee = 'owner' then tz_offset else null end
  from sign_contract_fields where contract_id = v_inst.template_id;

  update sign_contract_signers set
    access_token = v_token, status = 'sent', sent_at = now(), opened_at = null, signed_at = null, paid_at = null,
    inline_values = '{}'::jsonb, verification_locked = false, verification_lock_reason = null, verification_lock_step = null,
    verification_dest_attempts = 0, verification_code_attempts = 0, payment_status = 'none',
    verification_emails = case when v_tpl.verification_method in ('email','email_sms') and coalesce(email,'') <> '' then to_jsonb(array[email]) else '[]'::jsonb end,
    verification_phones = case when v_tpl.verification_method in ('sms','email_sms') and coalesce(phone,'') <> '' then to_jsonb(array[phone]) else '[]'::jsonb end,
    verification_pairs = case when v_tpl.verification_method = 'email_sms' and coalesce(email,'') <> '' and coalesce(phone,'') <> '' then jsonb_build_array(jsonb_build_object('email', email, 'phone', phone)) else '[]'::jsonb end,
    updated_at = now()
  where contract_id = p_instance_id and signer_index = 1;

  delete from sign_verification_codes where contract_id = p_instance_id;
  return v_token;
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_create_template_rep(p_template_id uuid, p_label text, p_email text)
 RETURNS sign_template_reps
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_row sign_template_reps; v_uid uuid;
begin
  select user_id into v_uid from sign_contracts where id = p_template_id and user_id = auth.uid() and is_template = true;
  if v_uid is null then raise exception 'non_autorise'; end if;
  insert into sign_template_reps (template_id, user_id, label, email, access_token)
  values (p_template_id, v_uid, btrim(p_label), btrim(lower(p_email)),
          replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''))
  returning * into v_row;
  return v_row;
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_revoke_template_rep(p_rep_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_uid uuid;
begin
  select user_id into v_uid from sign_template_reps where id = p_rep_id and user_id = auth.uid();
  if v_uid is null then raise exception 'non_autorise'; end if;
  update sign_template_reps set status = 'revoked', revoked_at = now(), updated_at = now() where id = p_rep_id;
  delete from sign_rep_devices where rep_id = p_rep_id;
  delete from sign_rep_codes where rep_id = p_rep_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_owner_generate_link(p_template_id uuid, p_signer_name text, p_signer_email text, p_signer_phone text)
 RETURNS TABLE(instance_id uuid, signer_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from sign_contracts where id = p_template_id and user_id = auth.uid() and is_template = true) then
    raise exception 'non_autorise';
  end if;
  return query select * from sign_clone_template_to_instance(p_template_id, null, p_signer_name, p_signer_email, p_signer_phone, 7);
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_owner_regenerate_instance(p_instance_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (select 1 from sign_contracts where id = p_instance_id and user_id = auth.uid()) then raise exception 'non_autorise'; end if;
  return sign_regenerate_instance_internal(p_instance_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_member_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_member sign_team_members%rowtype;
  v_owner_name text;
  v_templates jsonb;
begin
  select * into v_member from sign_team_members where user_id = auth.uid() and status = 'active' limit 1;
  if v_member.id is null then return null; end if;
  select coalesce(full_name, company, email) into v_owner_name from sign_users where id = v_member.owner_id;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
    into v_templates
  from sign_template_members stm
  join sign_contracts c on c.id = stm.template_id and c.is_template = true
  where stm.team_member_id = v_member.id;
  return jsonb_build_object(
    'member_id', v_member.id,
    'owner_id', v_member.owner_id,
    'owner_name', v_owner_name,
    'first_name', v_member.first_name,
    'last_name', v_member.last_name,
    'email', v_member.email,
    'templates', v_templates
  );
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_member_generate_link(p_template_id uuid, p_signer_name text, p_signer_email text, p_signer_phone text)
 RETURNS TABLE(instance_id uuid, signer_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_member_id uuid;
  v_instance uuid;
  v_token text;
begin
  select tm.id into v_member_id
  from sign_team_members tm
  join sign_template_members stm on stm.team_member_id = tm.id
  where tm.user_id = auth.uid() and tm.status = 'active' and stm.template_id = p_template_id
  limit 1;
  if v_member_id is null then raise exception 'non_autorise'; end if;

  select c.instance_id, c.signer_token into v_instance, v_token
  from sign_clone_template_to_instance(p_template_id, null, p_signer_name, p_signer_email, p_signer_phone, 7) c;

  update sign_contracts set team_member_id = v_member_id where id = v_instance;

  instance_id := v_instance; signer_token := v_token; return next;
end; $function$;

CREATE OR REPLACE FUNCTION public.sign_member_list_instances()
 RETURNS TABLE(id uuid, title text, status text, created_at timestamp with time zone, signed_at timestamp with time zone, expires_at timestamp with time zone, certificate_id text, template_id uuid, signer_name text, signer_email text, signer_token text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select c.id, c.title, c.status, c.created_at, c.signed_at, c.expires_at,
         c.certificate_id::text, c.template_id, s.name, s.email, s.access_token
  from sign_contracts c
  join sign_team_members tm on tm.id = c.team_member_id
  left join sign_contract_signers s on s.contract_id = c.id and s.signer_index = 1
  where tm.user_id = auth.uid() and tm.status = 'active' and c.is_template = false
  order by c.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.sign_member_regenerate_instance(p_instance_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not exists (
    select 1 from sign_contracts c
    join sign_team_members tm on tm.id = c.team_member_id
    where c.id = p_instance_id and tm.user_id = auth.uid() and tm.status = 'active'
  ) then raise exception 'non_autorise'; end if;
  return sign_regenerate_instance_internal(p_instance_id);
end; $function$;

-- Droits d'exécution tels qu'en production au 28/09/2026 : toutes les fonctions sont exécutables
-- par PUBLIC (défaut Postgres), sauf les deux fonctions « internes » ci-dessous, réservées à
-- service_role depuis le correctif appliqué en production le 28/09/2026 (elles étaient ouvertes à
-- anon et authenticated). Ne jamais les rouvrir : ce fichier, réappliqué, ne doit pas recréer la faille.
revoke execute on function public.sign_clone_template_to_instance(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.sign_regenerate_instance_internal(uuid) from public, anon, authenticated;
grant execute on function public.sign_clone_template_to_instance(uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.sign_regenerate_instance_internal(uuid) to service_role;

-- ───────────────────────────── Triggers ─────────────────────────────

drop trigger if exists trg_sign_contacts_updated on public.sign_contacts;
create trigger trg_sign_contacts_updated before update on public.sign_contacts for each row execute function sign_set_updated_at();

drop trigger if exists trg_sign_signers_guard on public.sign_contract_signers;
create trigger trg_sign_signers_guard before insert or update on public.sign_contract_signers for each row execute function sign_signers_guard();

drop trigger if exists trg_sign_signers_updated on public.sign_contract_signers;
create trigger trg_sign_signers_updated before update on public.sign_contract_signers for each row execute function sign_set_updated_at();

drop trigger if exists trg_sign_cert_guard on public.sign_contracts;
create trigger trg_sign_cert_guard before update on public.sign_contracts for each row execute function sign_cert_guard();

drop trigger if exists trg_sign_contracts_updated on public.sign_contracts;
create trigger trg_sign_contracts_updated before update on public.sign_contracts for each row execute function sign_set_updated_at();

drop trigger if exists trg_sign_guard_signing on public.sign_contracts;
create trigger trg_sign_guard_signing before update on public.sign_contracts for each row execute function sign_guard_signing();

drop trigger if exists trg_sign_events_immutable on public.sign_signature_events;
create trigger trg_sign_events_immutable before delete or update on public.sign_signature_events for each row execute function sign_events_immutable();

drop trigger if exists trg_sign_reps_updated on public.sign_template_reps;
create trigger trg_sign_reps_updated before update on public.sign_template_reps for each row execute function sign_set_updated_at();

drop trigger if exists trg_sign_users_separation on public.sign_users;
create trigger trg_sign_users_separation before insert or update of email on public.sign_users for each row execute function sign_enforce_account_separation();

drop trigger if exists trg_sign_users_updated on public.sign_users;
create trigger trg_sign_users_updated before update on public.sign_users for each row execute function sign_set_updated_at();

-- ───────────────────────────── RLS ─────────────────────────────
-- Toutes les tables sign_* ont la RLS activée. Sans policy = accès service_role uniquement.

alter table public.sign_contact_groups enable row level security;
alter table public.sign_contacts enable row level security;
alter table public.sign_contract_fields enable row level security;
alter table public.sign_contract_folders enable row level security;
alter table public.sign_contract_signers enable row level security;
alter table public.sign_contracts enable row level security;
alter table public.sign_device_codes enable row level security;
alter table public.sign_device_tokens enable row level security;
alter table public.sign_login_codes enable row level security;
alter table public.sign_otp_codes enable row level security;
alter table public.sign_owner_sign_sessions enable row level security;
alter table public.sign_rep_codes enable row level security;
alter table public.sign_rep_devices enable row level security;
alter table public.sign_secrets enable row level security;
alter table public.sign_signature_events enable row level security;
alter table public.sign_subscription_events enable row level security;
alter table public.sign_team_invites enable row level security;
alter table public.sign_team_members enable row level security;
alter table public.sign_template_members enable row level security;
alter table public.sign_template_reps enable row level security;
alter table public.sign_users enable row level security;
alter table public.sign_verification_codes enable row level security;
alter table public.sign_webhook_events enable row level security;

drop policy if exists sign_contact_groups_owner on public.sign_contact_groups;
create policy sign_contact_groups_owner on public.sign_contact_groups for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sign_contacts_owner on public.sign_contacts;
create policy sign_contacts_owner on public.sign_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sign_fields_owner on public.sign_contract_fields;
create policy sign_fields_owner on public.sign_contract_fields for all to authenticated
  using (exists (select 1 from sign_contracts c where c.id = sign_contract_fields.contract_id and c.user_id = auth.uid()))
  with check (exists (select 1 from sign_contracts c where c.id = sign_contract_fields.contract_id and c.user_id = auth.uid()));

drop policy if exists owner_all on public.sign_contract_folders;
create policy owner_all on public.sign_contract_folders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sign_signers_owner on public.sign_contract_signers;
create policy sign_signers_owner on public.sign_contract_signers for all to authenticated
  using (exists (select 1 from sign_contracts c where c.id = sign_contract_signers.contract_id and c.user_id = auth.uid()))
  with check (exists (select 1 from sign_contracts c where c.id = sign_contract_signers.contract_id and c.user_id = auth.uid()));

drop policy if exists sign_contracts_owner on public.sign_contracts;
create policy sign_contracts_owner on public.sign_contracts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sign_events_owner_select on public.sign_signature_events;
create policy sign_events_owner_select on public.sign_signature_events for select to authenticated
  using (exists (select 1 from sign_contracts c where c.id = sign_signature_events.contract_id and c.user_id = auth.uid()));

drop policy if exists sign_sub_events_owner_select on public.sign_subscription_events;
create policy sign_sub_events_owner_select on public.sign_subscription_events for select to authenticated
  using (exists (select 1 from sign_contracts c where c.id = sign_subscription_events.contract_id and c.user_id = auth.uid()));

drop policy if exists sign_team_invites_owner_all on public.sign_team_invites;
create policy sign_team_invites_owner_all on public.sign_team_invites for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists sign_team_members_owner_all on public.sign_team_members;
create policy sign_team_members_owner_all on public.sign_team_members for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists sign_team_members_self_read on public.sign_team_members;
create policy sign_team_members_self_read on public.sign_team_members for select
  using (user_id = auth.uid());

drop policy if exists sign_template_members_member_read on public.sign_template_members;
create policy sign_template_members_member_read on public.sign_template_members for select
  using (exists (select 1 from sign_team_members tm where tm.id = sign_template_members.team_member_id and tm.user_id = auth.uid()));

drop policy if exists sign_template_members_owner_all on public.sign_template_members;
create policy sign_template_members_owner_all on public.sign_template_members for all
  using (sign_owns_template(template_id)) with check (sign_owns_template(template_id));

drop policy if exists sign_template_reps_owner on public.sign_template_reps;
create policy sign_template_reps_owner on public.sign_template_reps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sign_users_owner on public.sign_users;
create policy sign_users_owner on public.sign_users for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ───────────────────────────── Stockage ─────────────────────────────
-- Bucket privé des PDF scellés et certificats. Aucune policy storage : accès service_role uniquement.

insert into storage.buckets (id, name, public)
values ('sign-documents', 'sign-documents', false)
on conflict (id) do nothing;
