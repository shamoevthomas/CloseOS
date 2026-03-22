-- Custom sources per organization (owner user_id)
CREATE TABLE IF NOT EXISTS business_custom_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE business_custom_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage custom sources"
  ON business_custom_sources FOR ALL
  USING (auth.uid() = user_id);
