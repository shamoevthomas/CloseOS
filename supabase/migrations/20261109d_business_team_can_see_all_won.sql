-- Page Équipe : les membres (setters / closers) voient-ils les gagnés de toute l'entreprise dans le CRM ?
-- false = un membre ne voit un prospect gagné que s'il en est le setter ou le closer (Head of Sales / Admin voient tout).
alter table public.business_settings add column if not exists team_can_see_all_won boolean not null default true;
