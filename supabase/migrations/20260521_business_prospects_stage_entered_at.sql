-- Track exactly when a prospect entered (or re-entered) the 'prospect' stage,
-- so DMR (Délai Moyen de Réponse) reflects time spent in that stage rather
-- than the original creation date.

ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS prospect_stage_entered_at TIMESTAMPTZ;

-- Trigger: stamp prospect_stage_entered_at = NOW() whenever stage becomes 'prospect'
CREATE OR REPLACE FUNCTION business_prospects_set_stage_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.stage = 'prospect' THEN
    NEW.prospect_stage_entered_at := COALESCE(NEW.prospect_stage_entered_at, NOW());
  ELSIF TG_OP = 'UPDATE'
        AND NEW.stage IS DISTINCT FROM OLD.stage
        AND NEW.stage = 'prospect' THEN
    NEW.prospect_stage_entered_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_prospects_stage_entered_at ON business_prospects;
CREATE TRIGGER trg_business_prospects_stage_entered_at
BEFORE INSERT OR UPDATE ON business_prospects
FOR EACH ROW EXECUTE FUNCTION business_prospects_set_stage_entered_at();

-- Backfill: for prospects currently in 'prospect' stage, take the most recent
-- history event where new_value = 'prospect' (a re-entry). If none, fall back
-- to created_at (they were created in this stage and never moved).
UPDATE business_prospects p
SET prospect_stage_entered_at = sub.entered_at
FROM (
  SELECT prospect_id, MAX(created_at) AS entered_at
  FROM business_prospect_history
  WHERE field_name = 'stage'
    AND new_value = 'prospect'
  GROUP BY prospect_id
) sub
WHERE p.id = sub.prospect_id
  AND p.stage = 'prospect'
  AND p.prospect_stage_entered_at IS NULL;

UPDATE business_prospects
SET prospect_stage_entered_at = created_at
WHERE stage = 'prospect'
  AND prospect_stage_entered_at IS NULL;
