-- Add Airtable integration columns
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS airtable_record_id text;

-- OAuth tokens for Airtable
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_access_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_refresh_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_token_expires_at bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_code_verifier text;

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_prospects_airtable_record_id ON prospects(airtable_record_id) WHERE airtable_record_id IS NOT NULL;
