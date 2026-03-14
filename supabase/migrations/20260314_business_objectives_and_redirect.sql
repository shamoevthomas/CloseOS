-- Migration: business_objectives table + redirect_url on business_campaigns

-- ─── Table business_objectives ───
CREATE TABLE IF NOT EXISTS business_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  metric text NOT NULL,
  target_value numeric NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own objectives"
  ON business_objectives FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own objectives"
  ON business_objectives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own objectives"
  ON business_objectives FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own objectives"
  ON business_objectives FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE business_objectives;

-- ─── Add redirect_url to business_campaigns ───
ALTER TABLE business_campaigns ADD COLUMN IF NOT EXISTS redirect_url text;
