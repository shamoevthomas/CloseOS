-- =================================================================
-- Sales-side iClosed parity
-- =================================================================
-- Brings the Sales product (offers + prospects tables) to feature parity
-- with the Business side for iClosed:
--   - per-offer custom stage mapping
--   - per-offer iClosed Bearer key (the user's iclosed_… key, used for OUR
--     outbound calls TO iClosed) — separate from offers.crm_api_key, which
--     is OUR generated token that the user pastes INTO iClosed for inbound
--     webhooks
--   - external_id idempotency on prospects (iclosed:<id>)
--   - source provider tracking on prospects
--   - HMAC secret + last sync timestamp

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_prospects_user_external
  ON prospects (user_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_offer_external
  ON prospects (offer_id, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS iclosed_stage_mapping jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS iclosed_hmac_secret text,
  ADD COLUMN IF NOT EXISTS iclosed_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS iclosed_push_key text;
