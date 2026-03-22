-- ============================================
-- Zapier / Webhook API Keys for Sales users
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text UNIQUE NOT NULL,
  name text DEFAULT 'Zapier',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own webhook keys"
  ON webhook_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhook keys"
  ON webhook_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhook keys"
  ON webhook_keys FOR DELETE
  USING (auth.uid() = user_id);
