-- Custom stages for Sales (solo users, no roles)
CREATE TABLE custom_stages (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#6366f1',
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_user ON custom_stages(user_id);
CREATE INDEX idx_cs_position ON custom_stages(user_id, position);

ALTER TABLE custom_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stages" ON custom_stages FOR ALL
  USING (user_id = auth.uid());
