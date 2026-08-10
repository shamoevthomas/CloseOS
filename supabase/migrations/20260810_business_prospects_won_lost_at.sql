-- ============================================
-- CloseOS Business — horodatage des décisions (gagné / perdu)
-- ============================================
-- Jusqu'ici le rapport filtrait le CA sur `created_at` du prospect : un lead
-- créé en mai et signé hier n'apparaissait pas dans « CA généré · 7 jours ».
-- On horodate donc l'entrée en stage « won » / « lost » pour pouvoir filtrer
-- sur la DATE DE DÉCISION et non sur la date de création.
--
-- Posé par trigger (comme set_contacted_at / set_noshow_at) et non côté app :
-- le stage bouge depuis l'UI, l'API, le MCP, les webhooks et les intégrations
-- (HubSpot, GHL, Airtable, Systeme.io, iClosed) — un seul point de vérité.

ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS won_at timestamptz;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS lost_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_business_prospects_won_at ON business_prospects(user_id, won_at);
CREATE INDEX IF NOT EXISTS idx_business_prospects_lost_at ON business_prospects(user_id, lost_at);

CREATE OR REPLACE FUNCTION public.set_decision_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Entrée (ou ré-entrée) en « gagné »
  IF NEW.stage = 'won' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'won') THEN
    NEW.won_at := now();
  END IF;
  -- Sortie de « gagné » : la vente n'en est plus une, on retire l'horodatage
  IF TG_OP = 'UPDATE' AND OLD.stage = 'won' AND NEW.stage IS DISTINCT FROM 'won' THEN
    NEW.won_at := NULL;
  END IF;

  IF NEW.stage = 'lost' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'lost') THEN
    NEW.lost_at := now();
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage = 'lost' AND NEW.stage IS DISTINCT FROM 'lost' THEN
    NEW.lost_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_decision_at ON business_prospects;
CREATE TRIGGER trg_set_decision_at
  BEFORE INSERT OR UPDATE ON business_prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_decision_at();

-- ─── Backfill ───
-- 1) Date exacte quand l'historique la connaît (business_prospect_history).
UPDATE business_prospects p
SET won_at = h.changed_at
FROM (
  SELECT prospect_id, MAX(created_at) AS changed_at
  FROM business_prospect_history
  WHERE field_name = 'stage' AND new_value = 'won'
  GROUP BY prospect_id
) h
WHERE p.id = h.prospect_id AND p.stage = 'won' AND p.won_at IS NULL;

UPDATE business_prospects p
SET lost_at = h.changed_at
FROM (
  SELECT prospect_id, MAX(created_at) AS changed_at
  FROM business_prospect_history
  WHERE field_name = 'stage' AND new_value = 'lost'
  GROUP BY prospect_id
) h
WHERE p.id = h.prospect_id AND p.stage = 'lost' AND p.lost_at IS NULL;

-- 2) Sinon : repli sur created_at — c'est exactement ce que le rapport
--    utilisait avant, donc aucune régression sur l'historique non tracé.
UPDATE business_prospects SET won_at = created_at WHERE stage = 'won' AND won_at IS NULL;
UPDATE business_prospects SET lost_at = created_at WHERE stage = 'lost' AND lost_at IS NULL;
