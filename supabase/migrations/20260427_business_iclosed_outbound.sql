-- =================================================================
-- Outbound iClosed integration (CloseOS Business → iClosed)
-- =================================================================
-- Stores the user's iClosed Bearer key (the one they generated in
-- iClosed → Settings → Developer → API Keys). This is DIFFERENT from
-- business_webhook_keys.api_key, which is OUR generated key that the
-- user pastes INTO iClosed for inbound webhooks.
--
-- Plain-text storage matches the existing pattern used for the
-- HubSpot access token, Airtable refresh token, etc. RLS on
-- business_settings already restricts SELECT to the owning user.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS iclosed_api_key text,
  ADD COLUMN IF NOT EXISTS iclosed_last_sync_at timestamptz;

-- Idempotency for inbound webhook + outbound push: a prospect is
-- uniquely identified by (user_id, external_id) where external_id is
-- the iClosed-side contact id prefixed with "iclosed:".
CREATE UNIQUE INDEX IF NOT EXISTS uniq_business_prospects_user_external
  ON business_prospects (user_id, external_id)
  WHERE external_id IS NOT NULL;
