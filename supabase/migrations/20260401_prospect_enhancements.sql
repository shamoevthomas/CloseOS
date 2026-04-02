-- Add loss_reason, loss_details, avatar_url to prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS loss_details text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS avatar_url text;

-- History/audit table for Sales prospects
CREATE TABLE IF NOT EXISTS prospect_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id integer NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_type text NOT NULL DEFAULT 'field_update',
  field_name text,
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ph_prospect ON prospect_history(prospect_id);
CREATE INDEX idx_ph_user ON prospect_history(user_id);
CREATE INDEX idx_ph_created ON prospect_history(prospect_id, created_at);

ALTER TABLE prospect_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own prospect history" ON prospect_history FOR ALL
  USING (user_id = auth.uid());
