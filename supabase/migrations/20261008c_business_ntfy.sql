-- Business : notifications push sur téléphone via ntfy (https://ntfy.sh) — test sur le compte tekatubois.
-- Les événements sont émis par des triggers (tous les chemins : réservation publique, formulaires,
-- webhooks, actions dans l'app) et envoyés en HTTP par pg_net, sans bloquer l'écriture.
-- Les rappels (basés sur l'heure) sont envoyés par le cron /api/cron/reminder-time-emails via ntfy_notify().

create table if not exists public.ntfy_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Le topic ntfy fait office de secret : quiconque le connaît peut lire les notifications.
  topic text not null,
  server text not null default 'https://ntfy.sh',
  enabled boolean not null default true,
  -- appointment | partial | won | form | reminder
  events text[] not null default array['appointment','partial','won','form','reminder'],
  created_at timestamptz not null default now()
);
alter table public.ntfy_subscriptions enable row level security;
revoke all on public.ntfy_subscriptions from anon, authenticated;

-- Envoi d'une notification (publication JSON ntfy). Ne lève jamais d'erreur.
create or replace function public.ntfy_notify(
  p_user uuid, p_event text, p_title text, p_message text,
  p_click text default null, p_tags text[] default null, p_priority int default 3
) returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select topic, server into s from public.ntfy_subscriptions
   where user_id = p_user and enabled and p_event = any(events);
  if not found then return; end if;
  perform net.http_post(
    url := s.server,
    body := jsonb_strip_nulls(jsonb_build_object(
      'topic', s.topic, 'title', p_title, 'message', p_message,
      'click', p_click, 'tags', to_jsonb(p_tags), 'priority', p_priority)),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
exception when others then
  raise warning 'ntfy_notify: %', sqlerrm;
end $$;
revoke all on function public.ntfy_notify(uuid, text, text, text, text, text[], int) from public, anon, authenticated;
grant execute on function public.ntfy_notify(uuid, text, text, text, text, text[], int) to service_role;

-- 1) Nouveau rendez-vous
create or replace function public.ntfy_on_business_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; member text;
begin
  if not exists (select 1 from public.ntfy_subscriptions where user_id = new.user_id and enabled) then return new; end if;
  if coalesce(new.status, '') in ('cancelled', 'canceled') then return new; end if;
  begin
    select coalesce(nullif(trim(p.contact), ''), trim(concat_ws(' ', p."firstName", p."lastName")))
      into who from public.business_prospects p where p.id = new.prospect_id;
    select trim(concat_ws(' ', m.first_name, m.last_name)) into member
      from public.business_team_members m where m.id = coalesce(new.assigned_to, new.team_member_id);
    perform public.ntfy_notify(
      new.user_id, 'appointment', 'Nouveau RDV',
      coalesce(nullif(who, ''), nullif(new.contact, ''), nullif(new.title, ''), 'Rendez-vous')
        || ' — ' || to_char(new.date, 'DD/MM') || ' à ' || to_char(new.time, 'HH24"h"MI')
        || case when nullif(member, '') is not null then ' · avec ' || member else '' end,
      'https://www.closeos.fr/business/rendez-vous', array['calendar']);
  exception when others then raise warning 'ntfy appointment: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_ntfy_business_appointment on public.business_appointments;
create trigger trg_ntfy_business_appointment after insert on public.business_appointments
  for each row execute function public.ntfy_on_business_appointment();

-- 2) Nouveau prospect incomplet  3) Prospect passé en gagné
create or replace function public.ntfy_on_business_prospect() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; camp text;
begin
  if not exists (select 1 from public.ntfy_subscriptions where user_id = new.user_id and enabled) then return new; end if;
  begin
    who := coalesce(nullif(trim(new.contact), ''), nullif(trim(concat_ws(' ', new."firstName", new."lastName")), ''), new.email, 'Prospect');
    if tg_op = 'INSERT' and new.stage = 'partial' then
      select name into camp from public.business_campaigns where id = new.campaign_id;
      perform public.ntfy_notify(new.user_id, 'partial', 'Nouveau prospect incomplet',
        who || coalesce(' — ' || camp, ''),
        'https://www.closeos.fr/business/crm', array['hourglass_flowing_sand']);
    elsif new.stage = 'won' and (tg_op = 'INSERT' or old.stage is distinct from 'won') then
      perform public.ntfy_notify(new.user_id, 'won', 'Deal gagné 🎉',
        who || case when coalesce(new.value, 0) > 0
                    then ' — ' || replace(to_char(new.value, 'FM999G999G990'), ',', ' ') || ' €' else '' end,
        'https://www.closeos.fr/business/crm', array['trophy'], 4);
    end if;
  exception when others then raise warning 'ntfy prospect: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_ntfy_business_prospect_ins on public.business_prospects;
create trigger trg_ntfy_business_prospect_ins after insert on public.business_prospects
  for each row execute function public.ntfy_on_business_prospect();
drop trigger if exists trg_ntfy_business_prospect_upd on public.business_prospects;
create trigger trg_ntfy_business_prospect_upd after update of stage on public.business_prospects
  for each row when (new.stage = 'won' and old.stage is distinct from 'won')
  execute function public.ntfy_on_business_prospect();

-- 4) Paliers de réponses aux formulaires : 1, 3, 5, 10, 30, 50, 100, puis toutes les 100
create or replace function public.ntfy_on_business_form_response() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; fname text;
begin
  if not exists (select 1 from public.ntfy_subscriptions where user_id = new.user_id and enabled) then return new; end if;
  begin
    select count(*) into n from public.business_form_responses where form_id = new.form_id;
    if n in (1, 3, 5, 10, 30, 50, 100) or (n > 100 and n % 100 = 0) then
      select name into fname from public.business_forms where id = new.form_id;
      perform public.ntfy_notify(new.user_id, 'form',
        case when n = 1 then 'Première réponse au formulaire' else n || ' réponses au formulaire' end,
        '« ' || coalesce(fname, 'Formulaire') || ' » vient d''atteindre ' || n || ' réponse' || case when n > 1 then 's' else '' end || '.',
        'https://www.closeos.fr/business/formulaires', array['memo'], case when n >= 50 then 4 else 3 end);
    end if;
  exception when others then raise warning 'ntfy form: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_ntfy_business_form_response on public.business_form_responses;
create trigger trg_ntfy_business_form_response after insert on public.business_form_responses
  for each row execute function public.ntfy_on_business_form_response();

revoke all on function public.ntfy_on_business_appointment() from public, anon, authenticated;
revoke all on function public.ntfy_on_business_prospect() from public, anon, authenticated;
revoke all on function public.ntfy_on_business_form_response() from public, anon, authenticated;
