-- =====================================================================
-- Full external-CRM fidelity for business_prospects
-- =====================================================================
-- Adds three columns so external CRMs / webhooks can push the FULL
-- lead context into CloseOS Business and have it persisted natively:
--
--   * lead_answers : structured Q&A from external sources (Calendly
--                    questions, custom webhook answers, Typeform, etc.)
--   * metadata     : free-form key-value pairs (UTM, custom fields, …)
--   * external_id  : idempotency key for upserts from external systems
--
-- Used by:
--   - api/zapier-webhook.ts (inbound CloseOS REST)
--   - api/webhooks.ts handleIclosedBusinessWebhook / handleCalendlyWebhook
--   - api/business.ts (HubSpot/Pipedrive/Airtable/GHL syncs)
--   - src/business/components/BusinessProspectView.tsx (display)

ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS lead_answers jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS metadata     jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS external_id  text;

CREATE INDEX IF NOT EXISTS idx_business_prospects_external
  ON business_prospects(user_id, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_prospects_metadata
  ON business_prospects USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_business_prospects_lead_ans
  ON business_prospects USING GIN (lead_answers);

COMMENT ON COLUMN business_prospects.lead_answers IS 'Structured Q&A from external sources (Calendly, custom webhooks, Typeform).';
COMMENT ON COLUMN business_prospects.metadata     IS 'Arbitrary custom fields pushed by external CRMs / webhooks.';
COMMENT ON COLUMN business_prospects.external_id  IS 'Idempotency key for upserts from external CRMs.';
