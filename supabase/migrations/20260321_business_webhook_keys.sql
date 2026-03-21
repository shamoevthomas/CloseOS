-- ============================================
-- Zapier / Webhook API Keys for Business orgs
-- ============================================

CREATE TABLE IF NOT EXISTS business_webhook_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  api_key text UNIQUE NOT NULL,
  name text DEFAULT 'Zapier',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_webhook_keys ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own keys
CREATE POLICY "Owner can read own webhook keys"
  ON business_webhook_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own webhook keys"
  ON business_webhook_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own webhook keys"
  ON business_webhook_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Team members can read their owner's keys (to see webhook URL in settings)
CREATE POLICY "Team members can read owner webhook keys"
  ON business_webhook_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_team_members
      WHERE business_team_members.user_id = auth.uid()
        AND business_team_members.business_owner_id = business_webhook_keys.user_id
    )
  );
