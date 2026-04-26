-- ============================================
-- Custom iClosed → CloseOS stage mapping (Business)
-- ============================================
-- Stores per-organization mapping of custom iClosed stage names
-- to one of the 6 CloseOS Business stages.
-- Format: { "MyCustomStage": "won", "Demo Booked": "qualified", ... }
-- Lookup is case-insensitive in the webhook handler.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS iclosed_stage_mapping jsonb DEFAULT '{}'::jsonb;
