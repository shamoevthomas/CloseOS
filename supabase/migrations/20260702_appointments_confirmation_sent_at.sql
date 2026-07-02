-- Fiabilise l'envoi des emails de confirmation de RDV.
-- Marqueur d'idempotence : la confirmation prospect n'est envoyée qu'une seule fois.
-- Le cron /api/cron/appointment-confirmations envoie pour tout RDV à venir lié à un
-- prospect avec email et dont confirmation_sent_at IS NULL (couvre tous les chemins :
-- création, prospect lié après coup, email ajouté après coup).
ALTER TABLE public.business_appointments
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

-- Filet anti-doublon au rollout : tout l'existant est marqué comme déjà traité,
-- pour que le cron ne s'occupe QUE des nouvelles réservations.
UPDATE public.business_appointments
  SET confirmation_sent_at = now()
  WHERE confirmation_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS business_appointments_pending_confirmation_idx
  ON public.business_appointments (datetime_utc)
  WHERE confirmation_sent_at IS NULL AND prospect_id IS NOT NULL;
