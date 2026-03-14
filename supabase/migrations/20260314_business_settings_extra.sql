ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS org_phone text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS org_email text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS onboarding_message text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS onboarding_video_url text;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb DEFAULT '[]'::jsonb;
