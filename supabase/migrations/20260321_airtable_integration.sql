-- Add Airtable integration columns (Sales)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS airtable_record_id text;
CREATE INDEX IF NOT EXISTS idx_prospects_airtable_record_id ON prospects(airtable_record_id) WHERE airtable_record_id IS NOT NULL;

-- Add Airtable integration columns (Business)
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS airtable_record_id text;
CREATE INDEX IF NOT EXISTS idx_business_prospects_airtable_record_id ON business_prospects(airtable_record_id) WHERE airtable_record_id IS NOT NULL;

-- Airtable config stored in business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS airtable_config jsonb DEFAULT '{}'::jsonb;

-- OAuth tokens for Airtable (shared between Sales & Business)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_access_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_refresh_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_token_expires_at bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airtable_code_verifier text;
