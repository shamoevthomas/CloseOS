-- ═══════════════════════════════════════════════════════════════════════
-- CloseOS CRM — new product ecosystem (Business Solo repositioned)
-- ═══════════════════════════════════════════════════════════════════════
-- crm_users: profile table for CRM-only accounts, strictly isolated from
-- Sales (profiles) and Business (business_users). Enforced via RLS + app-
-- level pre-checks during registration.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'Europe/Paris',
  has_onboarded BOOLEAN DEFAULT FALSE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  is_lifetime_free BOOLEAN DEFAULT FALSE,
  sidebar_order JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_users_email ON crm_users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_crm_users_stripe_customer ON crm_users(stripe_customer_id);

ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_users_select_own" ON crm_users;
CREATE POLICY "crm_users_select_own" ON crm_users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "crm_users_insert_own" ON crm_users;
CREATE POLICY "crm_users_insert_own" ON crm_users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "crm_users_update_own" ON crm_users;
CREATE POLICY "crm_users_update_own" ON crm_users
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION trg_crm_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_users_updated_at ON crm_users;
CREATE TRIGGER crm_users_updated_at
  BEFORE UPDATE ON crm_users
  FOR EACH ROW
  EXECUTE FUNCTION trg_crm_users_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- Integrations: inbound API keys (Zapier/Make/N8N → create prospects)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_webhook_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  api_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_keys_user ON crm_webhook_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_keys_apikey ON crm_webhook_keys(api_key);

ALTER TABLE crm_webhook_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_webhook_keys_own" ON crm_webhook_keys;
CREATE POLICY "crm_webhook_keys_own" ON crm_webhook_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- Integrations: outbound subscriptions (CRM → external URLs on events)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  last_status INTEGER,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_subs_user ON crm_webhook_subscriptions(user_id);

ALTER TABLE crm_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_webhook_subs_own" ON crm_webhook_subscriptions;
CREATE POLICY "crm_webhook_subs_own" ON crm_webhook_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- Symmetric outbound subscriptions for Business (same pattern)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  last_status INTEGER,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_webhook_subs_user ON business_webhook_subscriptions(user_id);

ALTER TABLE business_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_webhook_subs_own" ON business_webhook_subscriptions;
CREATE POLICY "business_webhook_subs_own" ON business_webhook_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
