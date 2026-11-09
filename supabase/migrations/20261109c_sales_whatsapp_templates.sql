-- CloseOS Sales : messages WhatsApp pré-remplis par relance (engrenage « Contacté » → Messages WhatsApp).
-- step 0 = premier contact, step n = relance n. Un jeu de messages par utilisateur Sales.
create table if not exists public.sales_whatsapp_templates (
  user_id uuid not null references auth.users(id) on delete cascade,
  step int not null check (step >= 0 and step <= 60),
  message text not null check (length(message) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, step)
);
alter table public.sales_whatsapp_templates enable row level security;
drop policy if exists sales_whatsapp_templates_own on public.sales_whatsapp_templates;
create policy sales_whatsapp_templates_own on public.sales_whatsapp_templates
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
