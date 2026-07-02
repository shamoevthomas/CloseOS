-- Les rappels Business sont rattachés à business_prospects, pas à prospects (Sales).
-- La FK reminders.prospect_id -> prospects(id) faisait échouer (409) la création d'un
-- rappel depuis BusinessProspectView. On ajoute une colonne dédiée pour Business.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS business_prospect_id bigint
  REFERENCES public.business_prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reminders_business_prospect_id_idx
  ON public.reminders(business_prospect_id);
