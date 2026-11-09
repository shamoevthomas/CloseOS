-- ═══════════════════════════════════════════════════════════════════════════
-- 1) ntfy « prospect incomplet » : notification différée de 10 minutes
--    Avant : push à l'insertion du lead 'partial', alors que le prospect est souvent encore en train de
--    remplir le formulaire (puis prend RDV → le lead passe en 'prospect').
--    Désormais : le trigger ne notifie plus les 'partial' ; la fonction ntfy_flush_partial_prospects()
--    (planifiée chaque minute avec pg_cron, voir en bas) notifie les leads restés 'partial' depuis ≥ 10 min.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.business_prospects add column if not exists ntfy_partial_notified_at timestamptz;

-- Pas de rattrapage : la fonction ne regarde que les leads devenus incomplets depuis moins de 24 h
-- (aucun au moment de la migration), donc pas de rafale de notifications à l'activation.

create or replace function public.ntfy_on_business_prospect() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if not exists (select 1 from public.ntfy_subscriptions where user_id = new.user_id and enabled) then return new; end if;
  begin
    who := coalesce(nullif(trim(new.contact), ''), nullif(trim(concat_ws(' ', new."firstName", new."lastName")), ''), new.email, 'Prospect');
    -- 'partial' : plus de push immédiat, voir ntfy_flush_partial_prospects()
    if new.stage = 'won' and (tg_op = 'INSERT' or old.stage is distinct from 'won') then
      perform public.ntfy_notify(new.user_id, 'won', 'Deal gagné 🎉',
        who || case when coalesce(new.value, 0) > 0
                    then ' — ' || replace(to_char(new.value, 'FM999G999G990'), ',', ' ') || ' €' else '' end,
        'https://www.closeos.fr/business/crm', array['trophy'], 4);
    end if;
  exception when others then raise warning 'ntfy prospect: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.ntfy_flush_partial_prospects(p_delay interval default interval '10 minutes')
returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; camp text; who text;
begin
  for r in
    select p.* from public.business_prospects p
     where p.stage = 'partial'
       and p.ntfy_partial_notified_at is null
       and coalesce(p.partial_at, p.created_at) <= now() - p_delay
       and coalesce(p.partial_at, p.created_at) >  now() - interval '1 day'
       and exists (select 1 from public.ntfy_subscriptions s
                    where s.user_id = p.user_id and s.enabled and 'partial' = any(s.events))
     order by p.created_at
     limit 200
     for update skip locked
  loop
    -- marqué d'abord : un envoi raté ne doit pas être rejoué en boucle chaque minute
    update public.business_prospects set ntfy_partial_notified_at = now() where id = r.id;
    begin
      who := coalesce(nullif(trim(r.contact), ''), nullif(trim(concat_ws(' ', r."firstName", r."lastName")), ''), r.email, 'Prospect');
      select name into camp from public.business_campaigns where id = r.campaign_id;
      perform public.ntfy_notify(r.user_id, 'partial', 'Prospect incomplet',
        who || coalesce(' — ' || camp, '') || ' (sans RDV depuis 10 min)',
        'https://www.closeos.fr/business/crm', array['hourglass_flowing_sand']);
      n := n + 1;
    exception when others then raise warning 'ntfy partial flush: %', sqlerrm;
    end;
  end loop;
  return n;
end $$;

revoke all on function public.ntfy_flush_partial_prospects(interval) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Emailing (page /business/emailing)
-- ═══════════════════════════════════════════════════════════════════════════

-- Groupes de prospects enregistrés (liste d'ids de business_prospects)
create table if not exists public.business_email_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  prospect_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_email_groups_owner_idx on public.business_email_groups(owner_id);
alter table public.business_email_groups enable row level security;

-- Le propriétaire, ou un Head of Sales / Admin de son équipe
create or replace function public.business_emailing_can_manage(p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = p_owner
      or exists (select 1 from public.business_team_members m
                  where m.business_owner_id = p_owner and m.user_id = auth.uid()
                    and m.role in ('Head of Sales', 'Admin'))
$$;

drop policy if exists business_email_groups_rw on public.business_email_groups;
create policy business_email_groups_rw on public.business_email_groups
  for all to authenticated
  using (public.business_emailing_can_manage(owner_id))
  with check (public.business_emailing_can_manage(owner_id));

-- Historique des envois (écrit par l'API avec le service role, lisible par l'équipe dirigeante)
create table if not exists public.business_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sent_by uuid references auth.users(id) on delete set null,
  subject text not null,
  mode text not null check (mode in ('text', 'html')),
  recipients_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  skipped_unsubscribed int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists business_email_campaigns_owner_idx on public.business_email_campaigns(owner_id, created_at desc);
alter table public.business_email_campaigns enable row level security;
drop policy if exists business_email_campaigns_read on public.business_email_campaigns;
create policy business_email_campaigns_read on public.business_email_campaigns
  for select to authenticated using (public.business_emailing_can_manage(owner_id));

-- Désinscriptions (lien en pied de chaque email) : jamais renvoyé à ces adresses
create table if not exists public.business_email_unsubscribes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, email)
);
alter table public.business_email_unsubscribes enable row level security;
drop policy if exists business_email_unsubscribes_read on public.business_email_unsubscribes;
create policy business_email_unsubscribes_read on public.business_email_unsubscribes
  for select to authenticated using (public.business_emailing_can_manage(owner_id));

-- Synchronisation vers un outil d'emailing (Brevo) : la clé API reste côté serveur (aucune policy = service role seul)
create table if not exists public.business_email_integrations (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'brevo',
  api_key text,
  list_id bigint,
  list_name text,
  auto_sync boolean not null default false,
  last_sync_at timestamptz,
  last_sync_count int,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.business_email_integrations enable row level security;
revoke all on public.business_email_integrations from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Planification du flush ntfy « incomplet » dans la base (pg_cron), chaque minute
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'ntfy-partial-flush';
select cron.schedule('ntfy-partial-flush', '* * * * *', $$select public.ntfy_flush_partial_prospects()$$);
