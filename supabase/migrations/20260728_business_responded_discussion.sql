-- Répondu + suivi de discussion (setter/setter-closer) sur business_prospects.
-- responded_at        : posé au clic "Répondu" (compte dans le taux de réponse, met les relances en pause).
-- discussion_next_at   : quand le prompt "Toujours en discussion ?" (+ email) redevient dû (responded_at + 1j, puis +1j si "Encore inconnu").
-- discussion_email_sent: dédup de l'email de rappel pour le cycle courant (remis à false à chaque nouveau cycle).
alter table public.business_prospects
  add column if not exists responded_at timestamptz,
  add column if not exists discussion_next_at timestamptz,
  add column if not exists discussion_email_sent boolean not null default false;

-- Index partiel : le cron ne balaie que les prospects en attente d'un email de discussion.
create index if not exists business_prospects_discussion_due_idx
  on public.business_prospects (discussion_next_at)
  where responded_at is not null and discussion_email_sent = false;
