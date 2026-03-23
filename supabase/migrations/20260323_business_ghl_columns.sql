-- Add GHL columns to business_prospects
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS ghl_opportunity_id TEXT;

-- Add GHL config to business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS ghl_config JSONB DEFAULT '{}';
