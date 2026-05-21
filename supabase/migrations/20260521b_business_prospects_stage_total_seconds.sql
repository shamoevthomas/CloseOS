-- Track accumulated time spent in the 'prospect' stage so DMR is stable
-- across stage changes. When a prospect leaves 'prospect', the elapsed
-- time is added to total_seconds and entered_at is cleared. When they
-- re-enter (multi-visit), entered_at is re-stamped — the previous visit
-- duration stays preserved in total_seconds.

ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS prospect_stage_total_seconds BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION business_prospects_set_stage_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.stage = 'prospect' THEN
    NEW.prospect_stage_entered_at := COALESCE(NEW.prospect_stage_entered_at, NOW());
  ELSIF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    -- Leaving 'prospect': lock the elapsed time into total_seconds
    IF OLD.stage = 'prospect' AND OLD.prospect_stage_entered_at IS NOT NULL THEN
      NEW.prospect_stage_total_seconds := COALESCE(OLD.prospect_stage_total_seconds, 0)
        + GREATEST(0, EXTRACT(EPOCH FROM (NOW() - OLD.prospect_stage_entered_at))::BIGINT);
      NEW.prospect_stage_entered_at := NULL;
    END IF;
    -- Entering 'prospect': stamp entered_at for the live counter
    IF NEW.stage = 'prospect' THEN
      NEW.prospect_stage_entered_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill total_seconds for prospects that already left 'prospect'.
-- Pair stage_change events (enter→exit) and sum the durations per prospect.
WITH stage_events AS (
  SELECT
    prospect_id,
    created_at AS ts,
    CASE
      WHEN new_value = 'prospect' THEN 'enter'
      WHEN old_value = 'prospect' THEN 'exit'
    END AS kind,
    ROW_NUMBER() OVER (PARTITION BY prospect_id ORDER BY created_at) AS rn
  FROM business_prospect_history
  WHERE field_name = 'stage'
    AND (new_value = 'prospect' OR old_value = 'prospect')
),
-- Add a synthetic "enter" event at created_at for prospects whose first
-- recorded stage_change has old_value='prospect' (they were born in 'prospect').
seeded AS (
  SELECT prospect_id, ts, kind FROM stage_events
  UNION ALL
  SELECT
    p.id AS prospect_id,
    p.created_at AS ts,
    'enter' AS kind
  FROM business_prospects p
  LEFT JOIN (
    SELECT DISTINCT ON (prospect_id) prospect_id, kind
    FROM stage_events
    ORDER BY prospect_id, rn
  ) first_evt ON first_evt.prospect_id = p.id
  WHERE first_evt.kind = 'exit' OR (first_evt.kind IS NULL AND p.stage = 'prospect')
),
ordered AS (
  SELECT
    prospect_id,
    ts,
    kind,
    ROW_NUMBER() OVER (PARTITION BY prospect_id ORDER BY ts) AS rn
  FROM seeded
),
paired AS (
  SELECT
    e.prospect_id,
    e.ts AS enter_ts,
    x.ts AS exit_ts
  FROM ordered e
  LEFT JOIN ordered x
    ON x.prospect_id = e.prospect_id
   AND x.rn = e.rn + 1
   AND x.kind = 'exit'
  WHERE e.kind = 'enter'
),
durations AS (
  SELECT
    prospect_id,
    SUM(
      GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(exit_ts, NOW()) - enter_ts))::BIGINT)
    ) AS total_seconds,
    SUM(CASE WHEN exit_ts IS NULL THEN 1 ELSE 0 END) AS open_visits
  FROM paired
  GROUP BY prospect_id
)
UPDATE business_prospects p
SET
  -- For prospects no longer in 'prospect', subtract any "still open" interval
  -- (we approximated it with NOW above) so total_seconds reflects only closed visits.
  prospect_stage_total_seconds = CASE
    WHEN p.stage = 'prospect' THEN
      -- Currently in 'prospect': total = closed visits only (live one tracked separately)
      GREATEST(0, d.total_seconds - GREATEST(0, EXTRACT(EPOCH FROM (NOW() - p.prospect_stage_entered_at))::BIGINT))
    ELSE
      -- Not currently in 'prospect': all paired intervals are real (closed)
      d.total_seconds
  END
FROM durations d
WHERE p.id = d.prospect_id;
