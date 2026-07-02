-- Notification email à la personne assignée à un RDV (closer/owner).
-- Marqueur d'idempotence : l'assigné n'est notifié qu'une seule fois.
-- Le cron /api/cron/appointment-confirmations envoie la notification pour tout RDV
-- à venir avec assigned_to et assignee_notified_at IS NULL (email complet + Meet + .ics).
ALTER TABLE public.business_appointments
  ADD COLUMN IF NOT EXISTS assignee_notified_at timestamptz;

-- Filet anti-doublon au rollout : tout l'existant est marqué comme déjà notifié.
UPDATE public.business_appointments
  SET assignee_notified_at = now()
  WHERE assignee_notified_at IS NULL;

CREATE INDEX IF NOT EXISTS business_appointments_pending_assignee_notif_idx
  ON public.business_appointments (datetime_utc)
  WHERE assignee_notified_at IS NULL AND assigned_to IS NOT NULL;
