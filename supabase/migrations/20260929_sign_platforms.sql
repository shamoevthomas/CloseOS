set client_min_messages = warning;
-- CloseOS Sign — lot 2 : comptes plateforme, sous-comptes artisans et API REST /api/sign/v1.
-- S'applique après 20260928_sign_unlock.sql.
--
-- Une plateforme (ex. le SaaS BTP) s'authentifie avec une clé API (stockée en SHA-256) et agit pour
-- ses artisans : des comptes Sign « techniques » rattachés à elle (platform_id), sans carte ni
-- abonnement propre, qui ne se connectent pas à l'interface. Tout passe par l'API, en service_role.

-- ─── 1. Plateformes ───
create table if not exists public.sign_platforms (
  id uuid default gen_random_uuid() not null,
  name text not null,
  api_key_hash text not null,
  api_key_hint text not null,
  scopes text[] default '{accounts:write,contracts:write,contracts:read}'::text[] not null,
  -- Secret de signature des webhooks (lot 4). Lisible par le serveur seulement (RLS sans policy).
  webhook_secret text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_platforms_pkey primary key (id),
  constraint sign_platforms_api_key_hash_key unique (api_key_hash)
);
alter table public.sign_platforms enable row level security;

-- ─── 2. Artisans rattachés à une plateforme ───
alter table public.sign_users add column if not exists platform_id uuid;
alter table public.sign_users add column if not exists external_ref text;
alter table public.sign_users add column if not exists contact_email text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sign_users_platform_id_fkey') then
    alter table public.sign_users add constraint sign_users_platform_id_fkey foreign key (platform_id) references public.sign_platforms(id) on delete restrict;
  end if;
end $$;
create index if not exists sign_users_platform_idx on public.sign_users (platform_id) where platform_id is not null;
-- Identifiant de l'artisan côté SaaS : unique par plateforme (création idempotente).
create unique index if not exists sign_users_platform_ref_uniq on public.sign_users (platform_id, external_ref)
  where platform_id is not null and external_ref is not null;

-- Le rattachement à une plateforme est réservé au serveur, comme l'abonnement et la clé MCP.
create or replace function public.sign_users_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if NEW.stripe_account_id is not null or NEW.stripe_connected or NEW.stripe_customer_id is not null
         or NEW.stripe_subscription_id is not null or NEW.subscription_status is not null
         or NEW.subscription_cycle is not null or NEW.current_period_end is not null
         or NEW.subscription_exempt or NEW.subscription_past_due_at is not null
         or coalesce(array_length(NEW.subscription_dunning_sent, 1), 0) > 0
         or NEW.mcp_key is not null or NEW.mcp_key_hash is not null or NEW.mcp_key_hint is not null
         or NEW.platform_id is not null or NEW.external_ref is not null then
        raise exception 'sign_users: champs réservés au serveur' using errcode = 'check_violation';
      end if;
    elsif NEW.stripe_account_id is distinct from OLD.stripe_account_id
       or NEW.stripe_connected is distinct from OLD.stripe_connected
       or NEW.stripe_customer_id is distinct from OLD.stripe_customer_id
       or NEW.stripe_subscription_id is distinct from OLD.stripe_subscription_id
       or NEW.subscription_status is distinct from OLD.subscription_status
       or NEW.subscription_cycle is distinct from OLD.subscription_cycle
       or NEW.current_period_end is distinct from OLD.current_period_end
       or NEW.subscription_exempt is distinct from OLD.subscription_exempt
       or NEW.subscription_past_due_at is distinct from OLD.subscription_past_due_at
       or NEW.subscription_dunning_sent is distinct from OLD.subscription_dunning_sent
       or NEW.mcp_key is distinct from OLD.mcp_key
       or NEW.mcp_key_hash is distinct from OLD.mcp_key_hash
       or NEW.mcp_key_hint is distinct from OLD.mcp_key_hint
       or NEW.platform_id is distinct from OLD.platform_id
       or NEW.external_ref is distinct from OLD.external_ref
       or NEW.id is distinct from OLD.id then
      raise exception 'sign_users: champs réservés au serveur' using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$function$;

-- ─── 3. Contrats : PDF dans Storage, liens avec expiration ───
-- PDF d'origine dans le bucket privé sign-documents (<contrat>/original.pdf) au lieu de base64 en base.
alter table public.sign_contracts add column if not exists pdf_path text;
-- Taille réelle de chaque page (points PDF), pour placer les champs en % sur un PDF non A4.
alter table public.sign_contracts add column if not exists page_sizes jsonb;
-- Expiration du lien de signature (null = pas d'expiration : comportement des contrats existants).
alter table public.sign_contract_signers add column if not exists link_expires_at timestamp with time zone;

-- ─── 4. Idempotence des requêtes API (en-tête Idempotency-Key) ───
create table if not exists public.sign_api_idempotency (
  platform_id uuid not null references public.sign_platforms(id) on delete cascade,
  key text not null,
  method text not null,
  path text not null,
  response_status integer not null,
  response_body jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_api_idempotency_pkey primary key (platform_id, key)
);
alter table public.sign_api_idempotency enable row level security;

-- ─── 5. Nouveau lien : repart pour 30 jours si le lien avait une expiration ───
-- (l'API peut ensuite fixer une autre durée ; les liens sans expiration restent sans expiration)
create or replace function public.sign_renew_signer_link_internal(p_signer_id uuid, p_actor uuid, p_via text, p_ip text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_signer sign_contract_signers%rowtype; v_token text;
begin
  v_signer := sign_reset_signer_verification(p_signer_id);
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update sign_contract_signers
     set access_token = v_token,
         link_expires_at = case when link_expires_at is null then null else now() + interval '30 days' end,
         updated_at = now()
   where id = p_signer_id;
  insert into sign_signature_events (contract_id, event_type, email, ip_address, metadata)
  values (v_signer.contract_id, 'link_renewed', v_signer.email, nullif(p_ip, '')::inet,
          jsonb_build_object('signer_index', v_signer.signer_index, 'via', p_via, 'actor', p_actor));
  return jsonb_build_object('contract_id', v_signer.contract_id, 'signer_id', v_signer.id, 'signer_index', v_signer.signer_index, 'token', v_token);
end; $function$;
revoke execute on function public.sign_renew_signer_link_internal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.sign_renew_signer_link_internal(uuid, uuid, text, text) to service_role;
