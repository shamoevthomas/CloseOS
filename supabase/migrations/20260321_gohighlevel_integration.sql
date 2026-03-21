-- Add GoHighLevel columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ghl_access_token text,
  ADD COLUMN IF NOT EXISTS ghl_refresh_token text,
  ADD COLUMN IF NOT EXISTS ghl_token_expires_at numeric,
  ADD COLUMN IF NOT EXISTS ghl_location_id text;

-- Add GoHighLevel columns to prospects
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS ghl_contact_id text,
  ADD COLUMN IF NOT EXISTS ghl_opportunity_id text;
