set client_min_messages = warning;
-- CloseOS Sign — déblocage d'un signataire et renouvellement de son lien, par le propriétaire.
-- S'applique après 20260927_sign_security.sql.
--
-- Deux actions, toujours côté serveur :
--   - « Débloquer » : lève le verrou de vérification, remet les essais à zéro et efface les codes en
--     cours du signataire (il recommence la vérification) ; le lien existant redevient utilisable.
--   - « Nouveau lien » : même remise à zéro + nouveau jeton, l'ancien lien cesse de fonctionner.
-- Chacune écrit un événement au journal (unlocked / link_renewed). Un signataire déjà signé est refusé.
--
-- Fonctions *_internal : réservées à service_role (MCP, future API REST) qui vérifient eux-mêmes le
-- propriétaire. Fonctions sign_owner_* : appelées depuis l'app, vérifient auth.uid().

-- ─── 1. Nouveaux types d'événements ───
alter table public.sign_signature_events drop constraint if exists sign_signature_events_event_type_check;
alter table public.sign_signature_events add constraint sign_signature_events_event_type_check CHECK ((event_type = ANY (ARRAY[
  'created'::text, 'sent'::text, 'opened'::text, 'otp_sent'::text, 'otp_verified'::text, 'signed'::text, 'paid'::text,
  'declined'::text, 'downloaded'::text, 'consent'::text, 'email_access'::text, 'sealed'::text, 'completed'::text,
  'certified'::text, 'security'::text, 'reminder'::text, 'unlocked'::text, 'link_renewed'::text])));

-- ─── 2. Le verrou ne se lève plus depuis le navigateur ───
-- La policy sign_signers_owner laisse le propriétaire écrire ses signataires (l'éditeur en a besoin).
-- Ce garde-fou interdit aux écritures directes (anon / authenticated) de toucher au verrou et aux
-- compteurs d'essais : le déblocage passe par les fonctions ci-dessous (SECURITY DEFINER, donc
-- exécutées sous le propriétaire des tables et non concernées). Fonction SECURITY INVOKER exprès :
-- current_user y reste le rôle appelant.
create or replace function public.sign_signers_verification_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user in ('anon', 'authenticated') and (
       NEW.verification_locked is distinct from OLD.verification_locked
    or NEW.verification_lock_reason is distinct from OLD.verification_lock_reason
    or NEW.verification_lock_step is distinct from OLD.verification_lock_step
    or NEW.verification_dest_attempts is distinct from OLD.verification_dest_attempts
    or NEW.verification_code_attempts is distinct from OLD.verification_code_attempts) then
    raise exception 'verrou de vérification : modification réservée au serveur' using errcode = 'check_violation';
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_sign_signers_verification_guard on public.sign_contract_signers;
create trigger trg_sign_signers_verification_guard before update on public.sign_contract_signers
  for each row execute function sign_signers_verification_guard();

-- ─── 3. Actions internes (service_role) ───

-- Remet la vérification d'un signataire à zéro et renvoie sa ligne ; refuse un signataire signé.
create or replace function public.sign_reset_signer_verification(p_signer_id uuid)
 returns sign_contract_signers
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_signer sign_contract_signers%rowtype; v_status text;
begin
  select * into v_signer from sign_contract_signers where id = p_signer_id for update;
  if v_signer.id is null then raise exception 'signataire_introuvable'; end if;
  if v_signer.status = 'signed' then raise exception 'signataire_deja_signe'; end if;
  select status into v_status from sign_contracts where id = v_signer.contract_id;
  if v_status is null or v_status in ('draft', 'signed', 'paid', 'cancelled') then raise exception 'contrat_non_en_cours'; end if;

  update sign_contract_signers set
    verification_locked = false, verification_lock_reason = null, verification_lock_step = null,
    verification_dest_attempts = 0, verification_code_attempts = 0, updated_at = now()
  where id = p_signer_id
  returning * into v_signer;
  -- Codes en cours effacés : sinon la limite de renvois atteinte l'empêcherait de recevoir un code.
  delete from sign_verification_codes where contract_id = v_signer.contract_id and signer_index = v_signer.signer_index;
  return v_signer;
end; $function$;

create or replace function public.sign_unlock_signer_internal(p_signer_id uuid, p_actor uuid, p_via text, p_ip text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_was_locked boolean; v_signer sign_contract_signers%rowtype;
begin
  select verification_locked into v_was_locked from sign_contract_signers where id = p_signer_id;
  v_signer := sign_reset_signer_verification(p_signer_id);
  insert into sign_signature_events (contract_id, event_type, email, ip_address, metadata)
  values (v_signer.contract_id, 'unlocked', v_signer.email, nullif(p_ip, '')::inet,
          jsonb_build_object('signer_index', v_signer.signer_index, 'via', p_via, 'actor', p_actor, 'was_locked', coalesce(v_was_locked, false)));
  return jsonb_build_object('contract_id', v_signer.contract_id, 'signer_id', v_signer.id, 'signer_index', v_signer.signer_index);
end; $function$;

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
  update sign_contract_signers set access_token = v_token, updated_at = now() where id = p_signer_id;
  insert into sign_signature_events (contract_id, event_type, email, ip_address, metadata)
  values (v_signer.contract_id, 'link_renewed', v_signer.email, nullif(p_ip, '')::inet,
          jsonb_build_object('signer_index', v_signer.signer_index, 'via', p_via, 'actor', p_actor));
  return jsonb_build_object('contract_id', v_signer.contract_id, 'signer_id', v_signer.id, 'signer_index', v_signer.signer_index, 'token', v_token);
end; $function$;

-- ─── 4. Actions du propriétaire connecté (app) ───

create or replace function public.sign_request_ip()
 returns text
 language sql
 stable
as $function$
  select nullif(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1), '');
$function$;

create or replace function public.sign_owner_unlock_signer(p_signer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if not exists (
    select 1 from sign_contract_signers s join sign_contracts c on c.id = s.contract_id
    where s.id = p_signer_id and c.user_id = auth.uid()
  ) then raise exception 'non_autorise'; end if;
  return sign_unlock_signer_internal(p_signer_id, auth.uid(), 'owner_app', sign_request_ip());
end; $function$;

create or replace function public.sign_owner_renew_signer_link(p_signer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if not exists (
    select 1 from sign_contract_signers s join sign_contracts c on c.id = s.contract_id
    where s.id = p_signer_id and c.user_id = auth.uid()
  ) then raise exception 'non_autorise'; end if;
  return sign_renew_signer_link_internal(p_signer_id, auth.uid(), 'owner_app', sign_request_ip());
end; $function$;

-- ─── 5. Droits ───
revoke execute on function public.sign_reset_signer_verification(uuid) from public, anon, authenticated;
revoke execute on function public.sign_unlock_signer_internal(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.sign_renew_signer_link_internal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.sign_reset_signer_verification(uuid) to service_role;
grant execute on function public.sign_unlock_signer_internal(uuid, uuid, text, text) to service_role;
grant execute on function public.sign_renew_signer_link_internal(uuid, uuid, text, text) to service_role;

revoke execute on function public.sign_owner_unlock_signer(uuid) from public, anon;
revoke execute on function public.sign_owner_renew_signer_link(uuid) from public, anon;
grant execute on function public.sign_owner_unlock_signer(uuid) to authenticated, service_role;
grant execute on function public.sign_owner_renew_signer_link(uuid) to authenticated, service_role;
