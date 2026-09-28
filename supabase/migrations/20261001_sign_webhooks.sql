set client_min_messages = warning;
-- CloseOS Sign — lot 4 : webhooks sortants pour les plateformes.
-- S'applique après 20260930_sign_server_seal.sql.
--
-- Chaque nouvel événement du journal (sign_signature_events) d'un contrat d'artisan de plateforme
-- devient, s'il correspond à un événement public, une livraison par adresse abonnée
-- (sign_webhook_deliveries). L'envoi (signature HMAC, 5 tentatives) est fait par Vercel
-- (api/_lib/sign-webhooks.js) : réveillé tout de suite par pg_net, repris chaque minute par la tâche.
-- Ce déclencheur ne bloque JAMAIS la signature : toute erreur y est rattrapée.

-- ─── 1. Droits : scope webhooks, rotation du secret ───
alter table public.sign_platforms alter column scopes set default '{accounts:write,contracts:write,contracts:read,webhooks:write}'::text[];
update public.sign_platforms set scopes = array_append(scopes, 'webhooks:write') where not ('webhooks:write' = any(scopes));
-- Rotation : l'ancien secret reste valable 24 h (les deux signatures sont envoyées).
alter table public.sign_platforms add column if not exists webhook_secret_previous text;
alter table public.sign_platforms add column if not exists webhook_secret_previous_until timestamp with time zone;

-- ─── 2. Adresses abonnées et journal des livraisons ───
create table if not exists public.sign_webhook_endpoints (
  id uuid default gen_random_uuid() not null,
  platform_id uuid not null references public.sign_platforms(id) on delete cascade,
  url text not null,
  events text[] not null,
  description text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint sign_webhook_endpoints_pkey primary key (id),
  constraint sign_webhook_endpoints_https check (url ~ '^https://')
);
create index if not exists sign_webhook_endpoints_platform_idx on public.sign_webhook_endpoints (platform_id) where active;
alter table public.sign_webhook_endpoints enable row level security;

create table if not exists public.sign_webhook_deliveries (
  id uuid default gen_random_uuid() not null,
  endpoint_id uuid not null references public.sign_webhook_endpoints(id) on delete cascade,
  platform_id uuid not null,
  event text not null,
  contract_id uuid,
  account_id uuid,
  payload jsonb not null,
  status text default 'pending' not null,
  attempts integer default 0 not null,
  next_attempt_at timestamp with time zone default now() not null,
  last_status_code integer,
  last_error text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint sign_webhook_deliveries_pkey primary key (id),
  constraint sign_webhook_deliveries_status_check check (status in ('pending', 'succeeded', 'failed'))
);
create index if not exists sign_webhook_deliveries_due_idx on public.sign_webhook_deliveries (next_attempt_at) where status = 'pending';
create index if not exists sign_webhook_deliveries_endpoint_idx on public.sign_webhook_deliveries (endpoint_id, created_at desc);
alter table public.sign_webhook_deliveries enable row level security;

-- ─── 3. Expiration des liens : événement du journal ───
alter table public.sign_signature_events drop constraint if exists sign_signature_events_event_type_check;
alter table public.sign_signature_events add constraint sign_signature_events_event_type_check CHECK ((event_type = ANY (ARRAY[
  'created'::text, 'sent'::text, 'opened'::text, 'otp_sent'::text, 'otp_verified'::text, 'signed'::text, 'paid'::text,
  'declined'::text, 'downloaded'::text, 'consent'::text, 'email_access'::text, 'sealed'::text, 'completed'::text,
  'certified'::text, 'security'::text, 'reminder'::text, 'unlocked'::text, 'link_renewed'::text, 'expired'::text])));
-- Date à laquelle l'expiration a été journalisée (une seule fois par lien).
alter table public.sign_contract_signers add column if not exists link_expired_logged_at timestamp with time zone;

-- Journalise « expired » pour chaque lien arrivé à échéance sans signature ; appelée chaque minute.
create or replace function public.sign_log_expired_links()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n integer;
begin
  with due as (
    update sign_contract_signers s set link_expired_logged_at = now()
      from sign_contracts c
     where c.id = s.contract_id
       and s.link_expires_at is not null and s.link_expires_at <= now()
       and s.link_expired_logged_at is null
       and s.status in ('sent', 'opened')
       and c.status not in ('signed', 'paid', 'cancelled', 'declined')
    returning s.contract_id, s.signer_index, s.email, s.link_expires_at
  )
  insert into sign_signature_events (contract_id, event_type, email, metadata)
  select contract_id, 'expired', email, jsonb_build_object('signer_index', signer_index, 'link_expires_at', link_expires_at) from due;
  get diagnostics n = row_count;
  return n;
end; $function$;
revoke execute on function public.sign_log_expired_links() from public, anon, authenticated;
grant execute on function public.sign_log_expired_links() to service_role;

-- Un nouveau lien pourra de nouveau expirer (et être signalé).
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
         link_expired_logged_at = null,
         updated_at = now()
   where id = p_signer_id;
  insert into sign_signature_events (contract_id, event_type, email, ip_address, metadata)
  values (v_signer.contract_id, 'link_renewed', v_signer.email, nullif(p_ip, '')::inet,
          jsonb_build_object('signer_index', v_signer.signer_index, 'via', p_via, 'actor', p_actor));
  return jsonb_build_object('contract_id', v_signer.contract_id, 'signer_id', v_signer.id, 'signer_index', v_signer.signer_index, 'token', v_token);
end; $function$;
revoke execute on function public.sign_renew_signer_link_internal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.sign_renew_signer_link_internal(uuid, uuid, text, text) to service_role;

-- ─── 4. Événement du journal → livraisons ───

-- Réveille l'envoi sur Vercel (pg_net, asynchrone). Sans pg_net ou sans secret : la tâche de
-- chaque minute prend le relais.
create or replace function public.sign_webhooks_kick()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_secret text;
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return; end if;
  select value into v_secret from sign_secrets where name = 'internal_email_secret';
  if v_secret is null then return; end if;
  execute 'select net.http_post($1, $2, $3, $4, $5)'
    using 'https://close-os.vercel.app/api/sign-internal?action=webhooks', '{}'::jsonb, '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-closeos-internal', v_secret), 5000;
end; $function$;
revoke execute on function public.sign_webhooks_kick() from public, anon, authenticated;

-- Crée une livraison par adresse active abonnée à l'événement. Renvoie le nombre créé.
create or replace function public.sign_webhooks_enqueue(p_contract_id uuid, p_event text, p_data jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_account uuid; v_platform uuid; n integer;
begin
  select c.user_id, u.platform_id into v_account, v_platform
    from sign_contracts c join sign_users u on u.id = c.user_id where c.id = p_contract_id;
  if v_platform is null then return 0; end if;
  with ins as (
    insert into sign_webhook_deliveries (endpoint_id, platform_id, event, contract_id, account_id, payload)
    select e.id, v_platform, p_event, p_contract_id, v_account,
           jsonb_build_object('event', p_event, 'product', 'sign', 'account_id', v_account, 'contract_id', p_contract_id,
                              'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'data', coalesce(p_data, '{}'::jsonb))
      from sign_webhook_endpoints e
     where e.platform_id = v_platform and e.active and p_event = any(e.events)
    returning 1
  )
  select count(*) into n from ins;
  return n;
end; $function$;
revoke execute on function public.sign_webhooks_enqueue(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.sign_events_to_webhooks()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_event text; v_idx integer; v_signer jsonb; v_data jsonb := '{}'::jsonb; v_contract record; n integer := 0;
begin
  begin
    -- Contrats d'artisans de plateforme uniquement (les autres ne paient rien ici).
    if not exists (select 1 from sign_contracts c join sign_users u on u.id = c.user_id
                    where c.id = NEW.contract_id and u.platform_id is not null) then
      return NEW;
    end if;
    v_idx := nullif(NEW.metadata ->> 'signer_index', '')::integer;
    v_event := case NEW.event_type
      when 'sent' then 'contract.sent'
      when 'opened' then 'signer.opened'
      when 'signed' then 'signer.signed'
      when 'declined' then 'signer.declined'
      when 'completed' then 'contract.completed'
      when 'certified' then 'contract.certified'
      when 'expired' then 'contract.expired'
      when 'security' then case when NEW.metadata ->> 'kind' = 'verification_locked' then 'signer.otp_locked' end
    end;
    if v_event is null then return NEW; end if;

    -- contract.sent : une seule fois (le premier envoi), pas à chaque signataire invité.
    if v_event = 'contract.sent' and exists (select 1 from sign_signature_events e
        where e.contract_id = NEW.contract_id and e.event_type = 'sent' and e.id <> NEW.id) then
      return NEW;
    end if;
    -- signer.opened : première ouverture de chaque signataire seulement.
    if v_event = 'signer.opened' and exists (select 1 from sign_signature_events e
        where e.contract_id = NEW.contract_id and e.event_type = 'opened' and e.id <> NEW.id
          and coalesce(e.metadata ->> 'signer_index', '1') = coalesce(NEW.metadata ->> 'signer_index', '1')) then
      return NEW;
    end if;

    if v_idx is not null then
      select jsonb_build_object('id', s.id, 'index', s.signer_index, 'name', s.name, 'email', s.email, 'status', s.status)
        into v_signer from sign_contract_signers s where s.contract_id = NEW.contract_id and s.signer_index = v_idx;
    end if;
    select c.status, c.title, c.sent_at, c.signed_at, c.certificate_id, c.certified_at into v_contract
      from sign_contracts c where c.id = NEW.contract_id;

    v_data := jsonb_strip_nulls(jsonb_build_object(
      'contract', jsonb_build_object('status', v_contract.status, 'title', v_contract.title),
      'signer', v_signer,
      'reason', case when v_event = 'signer.otp_locked' then NEW.metadata ->> 'reason' end,
      'link_expires_at', case when v_event = 'contract.expired' then NEW.metadata ->> 'link_expires_at' end,
      'signed_at', case when v_event = 'contract.completed' then v_contract.signed_at end,
      'certificate_id', case when v_event = 'contract.certified' then v_contract.certificate_id end,
      'certified_at', case when v_event = 'contract.certified' then v_contract.certified_at end
    ));
    n := sign_webhooks_enqueue(NEW.contract_id, v_event, v_data);
    if n > 0 then perform sign_webhooks_kick(); end if;
  exception when others then
    raise warning 'sign webhooks : événement % ignoré (%)', NEW.id, sqlerrm;
  end;
  return NEW;
end; $function$;
revoke execute on function public.sign_events_to_webhooks() from public, anon, authenticated;

drop trigger if exists trg_sign_events_to_webhooks on public.sign_signature_events;
create trigger trg_sign_events_to_webhooks after insert on public.sign_signature_events
  for each row execute function sign_events_to_webhooks();

-- contract.paid : quand le paiement du contrat passe à « payé » (tous les payeurs ont payé).
create or replace function public.sign_contract_paid_to_webhooks()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n integer;
begin
  begin
    if NEW.payment_status = 'paid' and OLD.payment_status is distinct from 'paid' then
      n := sign_webhooks_enqueue(NEW.id, 'contract.paid',
             jsonb_build_object('contract', jsonb_build_object('status', NEW.status, 'title', NEW.title), 'paid_at', NEW.paid_at));
      if n > 0 then perform sign_webhooks_kick(); end if;
    end if;
  exception when others then
    raise warning 'sign webhooks : paiement % ignoré (%)', NEW.id, sqlerrm;
  end;
  return NEW;
end; $function$;
revoke execute on function public.sign_contract_paid_to_webhooks() from public, anon, authenticated;

drop trigger if exists trg_sign_contract_paid_to_webhooks on public.sign_contracts;
create trigger trg_sign_contract_paid_to_webhooks after update of payment_status on public.sign_contracts
  for each row execute function sign_contract_paid_to_webhooks();

-- ─── 5. Prise en charge des livraisons dues (bail de 2 min, pas de double envoi) ───
create or replace function public.sign_webhook_claim(p_limit integer default 50)
 returns setof public.sign_webhook_deliveries
 language sql
 security definer
 set search_path to 'public'
as $function$
  update sign_webhook_deliveries d set next_attempt_at = now() + interval '2 minutes'
   where d.id in (select id from sign_webhook_deliveries
                   where status = 'pending' and next_attempt_at <= now()
                   order by next_attempt_at limit p_limit for update skip locked)
  returning d.*;
$function$;
revoke execute on function public.sign_webhook_claim(integer) from public, anon, authenticated;
grant execute on function public.sign_webhook_claim(integer) to service_role;
