-- Plusieurs sources par campagne et par lien de tracking (un lien par source).
-- Rétrocompatible : sans clé de source, tout se comporte comme avant (source principale = business_campaigns.source).
--   Campagne : /capture/:slug?src=<clé>     Tracking : /t/:slug?s=<clé>

-- Campagnes : sources supplémentaires [{ key, name }] + vues par clé { "<clé>": n }
alter table public.business_campaigns add column if not exists sources jsonb not null default '[]'::jsonb;
alter table public.business_campaigns add column if not exists source_views jsonb not null default '{}'::jsonb;

-- Prospect : clé de la source du lien d'arrivée (null = source principale ; le nom reste dans business_prospects.source)
alter table public.business_prospects add column if not exists campaign_source_key text;

-- Parcours (funnel) : source de la visite
alter table public.campaign_funnel_sessions add column if not exists source_key text;

-- Liens de tracking : sources [{ key, name }] + clé sur chaque clic
alter table public.business_tracking_links add column if not exists sources jsonb not null default '[]'::jsonb;
alter table public.business_tracking_events add column if not exists source_key text;
create index if not exists business_tracking_events_link_source_idx on public.business_tracking_events(link_id, source_key);

-- Vue de page de capture : +1 au total, et +1 sur la source si elle existe (atomique, appelée par l'API en service role)
create or replace function public.business_campaign_add_view(p_campaign uuid, p_source_key text default null)
returns void language sql security definer set search_path = public as $$
  update public.business_campaigns
     set views = coalesce(views, 0) + 1,
         source_views = case
           when p_source_key is null or p_source_key = '' then source_views
           else jsonb_set(coalesce(source_views, '{}'::jsonb), array[p_source_key],
                          to_jsonb(coalesce((source_views ->> p_source_key)::int, 0) + 1))
         end
   where id = p_campaign;
$$;
revoke all on function public.business_campaign_add_view(uuid, text) from public, anon, authenticated;
