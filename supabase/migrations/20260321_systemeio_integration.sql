-- Add Systeme.io integration fields

-- Store systemeio contact ID on prospects for bidirectional sync
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS systemeio_contact_id text;

-- Store Systeme.io API key on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS systemeio_api_key text;
