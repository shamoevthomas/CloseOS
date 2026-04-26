-- Extend crm_campaigns + crm_appointments + add payment sessions
-- to match Business CaptureForm features

-- ── Extend crm_campaigns ────────────────────────────────────────
ALTER TABLE crm_campaigns
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_title TEXT,
  ADD COLUMN IF NOT EXISTS landing_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS landing_text TEXT,
  ADD COLUMN IF NOT EXISTS landing_video_url TEXT,
  ADD COLUMN IF NOT EXISTS email_required BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS phone_required BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS capture_type TEXT DEFAULT 'without_rdv', -- 'with_rdv' | 'without_rdv'
  ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_price INTEGER, -- in cents
  ADD COLUMN IF NOT EXISTS stripe_currency TEXT DEFAULT 'eur',
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_window_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_duration_minutes INTEGER DEFAULT 30;

-- ── Extend crm_appointments ─────────────────────────────────────
ALTER TABLE crm_appointments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_amount_paid INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_currency TEXT,
  ADD COLUMN IF NOT EXISTS prospect_timezone TEXT;

-- ── Payment sessions for inline Stripe flow ────────────────────
CREATE TABLE IF NOT EXISTS crm_payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL,
  prospect_data JSONB,
  status TEXT DEFAULT 'pending', -- pending | completed | cancelled | refunded
  amount INTEGER,
  appointment_id BIGINT REFERENCES crm_appointments(id) ON DELETE SET NULL,
  prospect_id BIGINT REFERENCES crm_prospects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_payment_sessions_pi ON crm_payment_sessions (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_crm_payment_sessions_campaign ON crm_payment_sessions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_payment_sessions_status ON crm_payment_sessions (status, created_at);

ALTER TABLE crm_payment_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_payment_sessions_owner" ON crm_payment_sessions;
CREATE POLICY "crm_payment_sessions_owner" ON crm_payment_sessions
  FOR SELECT USING (auth.uid() = user_id);
-- Insert/Update done via service-role server-side only.

-- ── Partial leads (for analytics) ──────────────────────────────
CREATE TABLE IF NOT EXISTS crm_partial_leads (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  custom_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_partial_leads_user ON crm_partial_leads (user_id, created_at);

ALTER TABLE crm_partial_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_partial_leads_owner" ON crm_partial_leads;
CREATE POLICY "crm_partial_leads_owner" ON crm_partial_leads
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger for updated_at on crm_payment_sessions
DROP TRIGGER IF EXISTS trg_crm_payment_sessions_updated ON crm_payment_sessions;
CREATE TRIGGER trg_crm_payment_sessions_updated BEFORE UPDATE ON crm_payment_sessions
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
