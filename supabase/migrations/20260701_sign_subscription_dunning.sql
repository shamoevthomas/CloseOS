-- CloseOS Sign — relances de paiement (dunning) + ancrage de la grâce sur le 1er échec.
--
-- Contexte : après un échec de paiement en fin d'essai, Stripe avance current_period_end
-- vers la période suivante (futur) → inutilisable pour calculer la grâce. On mémorise donc
-- la date du 1er échec (subscription_past_due_at) qui ancre la grâce de 3 jours ET la
-- cadence des relances. subscription_dunning_sent évite les doublons d'emails.

alter table public.sign_users
  add column if not exists subscription_past_due_at timestamptz,
  add column if not exists subscription_dunning_sent text[] not null default '{}';

comment on column public.sign_users.subscription_past_due_at is
  'Date du 1er échec de paiement (ancre la grâce de 3 j et les relances). NULL si à jour.';
comment on column public.sign_users.subscription_dunning_sent is
  'Étapes de relance déjà envoyées : failed, pre_block, blocked, post_block.';
