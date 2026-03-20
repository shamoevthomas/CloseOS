-- Timezone support
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Paris';
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Paris';
ALTER TABLE business_appointments ADD COLUMN IF NOT EXISTS datetime_utc timestamptz;
ALTER TABLE business_appointments ADD COLUMN IF NOT EXISTS timezone text;

-- Backfill existing appointments assuming Europe/Paris
UPDATE business_appointments
SET datetime_utc = (date || ' ' || COALESCE(time, '00:00'))::timestamp AT TIME ZONE 'Europe/Paris',
    timezone = 'Europe/Paris'
WHERE datetime_utc IS NULL AND date IS NOT NULL;
