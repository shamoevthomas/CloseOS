CREATE TABLE IF NOT EXISTS business_custom_stages (
  id SERIAL PRIMARY KEY,
  business_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  roles TEXT[] NOT NULL DEFAULT '{"Closer"}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE business_custom_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON business_custom_stages
  FOR ALL USING (business_owner_id = auth.uid());

CREATE POLICY "team_read" ON business_custom_stages
  FOR SELECT USING (
    business_owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );
