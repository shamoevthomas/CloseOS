-- Add Airtable integration columns
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS airtable_record_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_api_key text;

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_prospects_airtable_record_id ON prospects(airtable_record_id) WHERE airtable_record_id IS NOT NULL;
