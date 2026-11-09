-- Messages WhatsApp pré-remplis par étape de relance « Contacté » (pop-up de l'engrenage, onglet « Messages WhatsApp »).
-- step 0 = premier contact, step n = relance n. Utilisés sur la fiche prospect (bouton WhatsApp → wa.me?text=…).
create table if not exists public.business_whatsapp_templates (
  owner_id uuid not null references auth.users(id) on delete cascade,
  step int not null check (step >= 0 and step <= 60),
  message text not null check (length(message) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, step)
);
alter table public.business_whatsapp_templates enable row level security;

-- Lecture : le propriétaire et tous les membres de son équipe (setters / closers s'en servent sur la fiche)
create or replace function public.business_is_in_team_of(p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = p_owner
      or exists (select 1 from public.business_team_members m where m.business_owner_id = p_owner and m.user_id = auth.uid())
$$;

drop policy if exists business_whatsapp_templates_read on public.business_whatsapp_templates;
create policy business_whatsapp_templates_read on public.business_whatsapp_templates
  for select to authenticated using (public.business_is_in_team_of(owner_id));

-- Écriture : propriétaire, Head of Sales, Admin
drop policy if exists business_whatsapp_templates_write on public.business_whatsapp_templates;
create policy business_whatsapp_templates_write on public.business_whatsapp_templates
  for all to authenticated
  using (public.business_emailing_can_manage(owner_id))
  with check (public.business_emailing_can_manage(owner_id));
