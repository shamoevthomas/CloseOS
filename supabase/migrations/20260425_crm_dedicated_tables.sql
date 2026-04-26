-- ════════════════════════════════════════════════════════════════
-- CloseOS CRM — dedicated tables (no more sharing with business_*)
-- Each table mirrors its business_* counterpart but is owned by
-- crm_users.id and isolated via RLS.
-- ════════════════════════════════════════════════════════════════

-- ── 1. crm_prospects ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_prospects (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  stage TEXT NOT NULL DEFAULT 'prospect',
  previous_stage TEXT,
  value NUMERIC DEFAULT 0,
  offer TEXT,
  formula_id UUID,
  campaign_id UUID,
  notes TEXT,
  call_notes JSONB DEFAULT '[]'::jsonb,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  avatar_url TEXT,
  -- Stripe matching (for paid campaigns)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  subscription_amount NUMERIC,
  subscription_interval TEXT,
  matched_via TEXT,
  last_payment_date TIMESTAMPTZ,
  next_payment_date TIMESTAMPTZ,
  last_contact TIMESTAMPTZ,
  loss_reason TEXT,
  loss_details TEXT,
  pipeline_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_prospects_user ON crm_prospects (user_id);
CREATE INDEX IF NOT EXISTS idx_crm_prospects_stage ON crm_prospects (user_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_prospects_campaign ON crm_prospects (campaign_id);

ALTER TABLE crm_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_prospects_owner" ON crm_prospects;
CREATE POLICY "crm_prospects_owner" ON crm_prospects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 2. crm_formulas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  description TEXT,
  resources JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  billing_type TEXT DEFAULT 'one_time', -- one_time | subscription | quote
  billing_interval TEXT,                -- monthly | quarterly | annual (null when one_time/quote)
  yearly_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_formulas_user ON crm_formulas (user_id);
ALTER TABLE crm_formulas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_formulas_owner" ON crm_formulas;
CREATE POLICY "crm_formulas_owner" ON crm_formulas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 3. crm_campaigns ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  capture_mode TEXT DEFAULT 'form', -- form | booking | questionnaire
  formula_id UUID REFERENCES crm_formulas(id) ON DELETE SET NULL,
  stripe_price_id TEXT,
  payment_timing TEXT, -- before | after
  redirect_url TEXT,
  fields JSONB DEFAULT '[]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_user ON crm_campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_slug ON crm_campaigns (slug);
ALTER TABLE crm_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_campaigns_owner" ON crm_campaigns;
CREATE POLICY "crm_campaigns_owner" ON crm_campaigns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Public read for capture pages (slug lookup)
DROP POLICY IF EXISTS "crm_campaigns_public_read" ON crm_campaigns;
CREATE POLICY "crm_campaigns_public_read" ON crm_campaigns
  FOR SELECT USING (is_active = TRUE);

-- ── 4. crm_appointments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_appointments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id BIGINT REFERENCES crm_prospects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  datetime_utc TIMESTAMPTZ,
  date DATE,
  time TEXT,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled', -- scheduled | done | noshow | cancelled
  meeting_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_appointments_user ON crm_appointments (user_id);
CREATE INDEX IF NOT EXISTS idx_crm_appointments_prospect ON crm_appointments (prospect_id);
ALTER TABLE crm_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_appointments_owner" ON crm_appointments;
CREATE POLICY "crm_appointments_owner" ON crm_appointments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 5. crm_custom_stages ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_custom_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_custom_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_custom_stages_owner" ON crm_custom_stages;
CREATE POLICY "crm_custom_stages_owner" ON crm_custom_stages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 6. crm_tags ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_tags_owner" ON crm_tags;
CREATE POLICY "crm_tags_owner" ON crm_tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS crm_prospect_tags (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id BIGINT NOT NULL REFERENCES crm_prospects(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (prospect_id, tag_id)
);
ALTER TABLE crm_prospect_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_prospect_tags_owner" ON crm_prospect_tags;
CREATE POLICY "crm_prospect_tags_owner" ON crm_prospect_tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 7. crm_stage_history ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_stage_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id BIGINT NOT NULL REFERENCES crm_prospects(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_stage_history_prospect ON crm_stage_history (prospect_id);
ALTER TABLE crm_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_stage_history_owner" ON crm_stage_history;
CREATE POLICY "crm_stage_history_owner" ON crm_stage_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 8. updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION crm_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_prospects_updated ON crm_prospects;
CREATE TRIGGER trg_crm_prospects_updated BEFORE UPDATE ON crm_prospects
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_formulas_updated ON crm_formulas;
CREATE TRIGGER trg_crm_formulas_updated BEFORE UPDATE ON crm_formulas
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_campaigns_updated ON crm_campaigns;
CREATE TRIGGER trg_crm_campaigns_updated BEFORE UPDATE ON crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_appointments_updated ON crm_appointments;
CREATE TRIGGER trg_crm_appointments_updated BEFORE UPDATE ON crm_appointments
  FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();

-- ── 9. Auto-record stage history when prospect.stage changes ───
CREATE OR REPLACE FUNCTION crm_record_stage_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO crm_stage_history (user_id, prospect_id, from_stage, to_stage)
    VALUES (NEW.user_id, NEW.id, OLD.stage, NEW.stage);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_prospects_stage_history ON crm_prospects;
CREATE TRIGGER trg_crm_prospects_stage_history AFTER UPDATE ON crm_prospects
  FOR EACH ROW EXECUTE FUNCTION crm_record_stage_change();
