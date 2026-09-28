set client_min_messages = warning;
-- CloseOS Sign — lot 3 : PDF signé et certificat produits par le serveur, purge Storage en cascade.
-- S'applique après 20260929_sign_platforms.sql.

-- ─── 1. Scellement serveur ───
-- sealed_by : 'server' (PDF d'origine + champs dessinés par le serveur) ou 'browser' (ancien chemin,
-- gardé en secours pendant la migration). seal_started_at : verrou posé par le serveur pendant le
-- scellement, pour qu'une seule exécution scelle (deux derniers signataires simultanés).
alter table public.sign_contracts add column if not exists sealed_by text;
alter table public.sign_contracts add column if not exists seal_started_at timestamp with time zone;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sign_contracts_sealed_by_check') then
    alter table public.sign_contracts add constraint sign_contracts_sealed_by_check check (sealed_by is null or sealed_by in ('server', 'browser'));
  end if;
end $$;
-- Contrats déjà scellés : ils l'ont été par le navigateur.
update public.sign_contracts set sealed_by = 'browser' where sealed_hash is not null and sealed_by is null;

-- Ces colonnes rejoignent les champs de certificat réservés au serveur.
create or replace function public.sign_cert_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare jwt_role text;
begin
  jwt_role := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
  if jwt_role in ('anon','authenticated') then
    if NEW.sealed_hash is distinct from OLD.sealed_hash
       or NEW.certificate_hash is distinct from OLD.certificate_hash
       or NEW.certificate_path is distinct from OLD.certificate_path
       or NEW.certificate_id is distinct from OLD.certificate_id
       or NEW.certified_at is distinct from OLD.certified_at
       or NEW.sealed_by is distinct from OLD.sealed_by
       or NEW.seal_started_at is distinct from OLD.seal_started_at then
      raise exception 'certificate fields are server-only' using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$function$;

-- ─── 2. Purge des fichiers Storage à la suppression d'un contrat ───
-- La base ne peut pas effacer les objets Storage elle-même : la suppression d'un contrat inscrit
-- son dossier (<contrat>/) dans une file, vidée par la tâche planifiée via l'API Storage.
-- Un contrat sous conservation légale (purge_hold) ne peut pas être supprimé (trigger du lot 1) :
-- il n'entre donc jamais dans la file.
create table if not exists public.sign_storage_purge_queue (
  contract_id uuid not null,
  enqueued_at timestamp with time zone default now() not null,
  done_at timestamp with time zone,
  attempts integer default 0 not null,
  last_error text,
  constraint sign_storage_purge_queue_pkey primary key (contract_id)
);
alter table public.sign_storage_purge_queue enable row level security;

create or replace function public.sign_contracts_enqueue_purge()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into sign_storage_purge_queue (contract_id) values (OLD.id) on conflict (contract_id) do nothing;
  return OLD;
end;
$function$;
revoke execute on function public.sign_contracts_enqueue_purge() from public, anon, authenticated;

drop trigger if exists trg_sign_contracts_enqueue_purge on public.sign_contracts;
create trigger trg_sign_contracts_enqueue_purge after delete on public.sign_contracts
  for each row execute function sign_contracts_enqueue_purge();

-- ─── 3. Verrou de scellement ───
-- Pris par le serveur avant de sceller : un seul scellement à la fois par contrat. Refusé si le
-- contrat est déjà certifié ou scellé par le navigateur ; un verrou de plus de 5 minutes (exécution
-- interrompue) peut être repris.
create or replace function public.sign_seal_lock(p_contract_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update sign_contracts set seal_started_at = now()
   where id = p_contract_id
     and certified_at is null
     and (sealed_by is null or sealed_by = 'server')
     and (seal_started_at is null or seal_started_at < now() - interval '5 minutes');
  return found;
end;
$function$;
revoke execute on function public.sign_seal_lock(uuid) from public, anon, authenticated;
grant execute on function public.sign_seal_lock(uuid) to service_role;
