-- Add timezone to business_prospects, used to format prospect-facing emails
-- and display the prospect's local time in the closer UI.

ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Backfill from the prospect's most recent appointment.
UPDATE business_prospects p
SET timezone = sub.tz
FROM (
  SELECT DISTINCT ON (prospect_id)
    prospect_id,
    timezone AS tz
  FROM business_appointments
  WHERE prospect_id IS NOT NULL
    AND timezone IS NOT NULL
    AND timezone <> ''
  ORDER BY
    prospect_id,
    COALESCE(
      datetime_utc::timestamptz,
      (date::text || 'T' || COALESCE(time::text, '00:00:00'))::timestamptz
    ) DESC
) sub
WHERE p.id = sub.prospect_id
  AND p.timezone IS NULL;
