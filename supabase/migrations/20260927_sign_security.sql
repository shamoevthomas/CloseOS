set client_min_messages = warning;
-- CloseOS Sign — correctifs de sécurité (lot 1). S'applique après 20260927_sign_baseline.sql.
--
-- ORDRE DE DÉPLOIEMENT : déployer d'abord le code Vercel (api/mcp.js lit mcp_key_hash puis, à
-- défaut, l'ancienne colonne), PUIS appliquer cette migration, qui efface les clés MCP en clair.

-- ─── 1. Fonctions internes : plus appelables depuis le navigateur ───
-- Seuls sign-rep (service_role) et les RPC propriétaire/membre (SECURITY DEFINER, qui vérifient
-- auth.uid()) doivent pouvoir cloner un modèle ou réinitialiser une instance.
revoke execute on function public.sign_clone_template_to_instance(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.sign_regenerate_instance_internal(uuid) from public, anon, authenticated;
grant execute on function public.sign_clone_template_to_instance(uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.sign_regenerate_instance_internal(uuid) to service_role;

-- ─── 2. sign_users : colonnes réservées au serveur ───
-- La policy sign_users_owner laisse le propriétaire écrire toute sa ligne. Ce garde-fou interdit aux
-- écritures directes (PostgREST, rôle anon/authenticated) de toucher à l'abonnement, à Stripe et à
-- la clé MCP. Il teste current_user : les fonctions SECURITY DEFINER (provisionnement Business,
-- RPC de clé MCP) s'exécutent sous le propriétaire des tables et restent autorisées.
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
         or NEW.mcp_key is not null or NEW.mcp_key_hash is not null or NEW.mcp_key_hint is not null then
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
       or NEW.id is distinct from OLD.id then
      raise exception 'sign_users: champs réservés au serveur' using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$function$;

-- ─── 3. Clé MCP hashée ───
-- La clé n'est plus stockée en clair : seulement son SHA-256 (recherche) et un indice lisible
-- (sk_ab12…9f3e) pour l'affichage. Elle n'est montrée en entier qu'une fois, à la génération.
alter table public.sign_users add column if not exists mcp_key_hash text;
alter table public.sign_users add column if not exists mcp_key_hint text;
create unique index if not exists sign_users_mcp_key_hash_idx on public.sign_users (mcp_key_hash) where mcp_key_hash is not null;

drop trigger if exists trg_sign_users_guard on public.sign_users;
create trigger trg_sign_users_guard before insert or update on public.sign_users for each row execute function sign_users_guard();

-- Les clés existantes continuent de fonctionner : on garde leur empreinte, on efface le clair.
update public.sign_users
   set mcp_key_hash = encode(extensions.digest(mcp_key, 'sha256'), 'hex'),
       mcp_key_hint = left(mcp_key, 7) || '…' || right(mcp_key, 4),
       mcp_key = null
 where mcp_key is not null;

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
  update sign_users
     set mcp_key = null,
         mcp_key_hash = encode(digest(v_key, 'sha256'), 'hex'),
         mcp_key_hint = left(v_key, 7) || '…' || right(v_key, 4)
   where id = auth.uid();
  return v_key; -- seule fois où la clé complète est visible
end; $function$;

-- Ne renvoie plus la clé : seulement son indice, ou null si aucune clé active.
CREATE OR REPLACE FUNCTION public.sign_get_mcp_key()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$ select mcp_key_hint from sign_users where id = auth.uid() and mcp_key_hash is not null; $function$;

CREATE OR REPLACE FUNCTION public.sign_revoke_mcp_key()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  update sign_users set mcp_key = null, mcp_key_hash = null, mcp_key_hint = null where id = auth.uid();
end; $function$;

-- ─── 4. Conservation légale : un contrat sous purge_hold ne se supprime pas ───
-- S'applique à tous les rôles, service_role compris (MCP, crons, UI).
create or replace function public.sign_contracts_purge_hold_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if OLD.purge_hold then
    raise exception 'contrat sous conservation légale (purge_hold) : suppression interdite' using errcode = 'check_violation';
  end if;
  return OLD;
end;
$function$;

drop trigger if exists trg_sign_contracts_purge_hold on public.sign_contracts;
create trigger trg_sign_contracts_purge_hold before delete on public.sign_contracts for each row execute function sign_contracts_purge_hold_guard();

-- ─── 5. Signature propriétaire : compteur d'envois du code ───
alter table public.sign_owner_sign_sessions add column if not exists code_sends integer default 0 not null;
