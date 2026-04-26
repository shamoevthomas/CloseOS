-- =================================================================
-- iClosed integration audit log
-- =================================================================
-- Append-only log of every outbound push, inbound webhook, and sync
-- operation for the iClosed integration. Useful for debugging and for
-- showing the user a "last activity" feed in the UI.
--
-- Direction:
--   - 'outbound' : CloseOS → iClosed (upsertContact, updateContact, setOutcome, createDeal)
--   - 'inbound'  : iClosed → CloseOS (webhook delivered to handleIclosed*Webhook)
--   - 'sync'     : initial pull (handleIclosedSync*)

CREATE TABLE IF NOT EXISTS iclosed_push_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id integer,
  prospect_id bigint,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound','sync')),
  iclosed_resource text,             -- 'contact' | 'deal' | 'outcome' | 'eventCall' | etc.
  iclosed_id text,                   -- the iClosed-side id when known
  status text,                       -- 'ok' | 'error' | 'skipped' | 'pending'
  error_code text,                   -- iClosed client error.code: 'auth' | 'rate_limit' | 'validation' | …
  error_message text,
  request_body jsonb,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iclosed_push_log_user_created
  ON iclosed_push_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iclosed_push_log_prospect
  ON iclosed_push_log (prospect_id) WHERE prospect_id IS NOT NULL;

ALTER TABLE iclosed_push_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iclosed_push_log_select_own ON iclosed_push_log;
CREATE POLICY iclosed_push_log_select_own
  ON iclosed_push_log FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts go through the service-role API only (no client INSERT policy).
