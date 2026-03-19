-- Personal objectives created by team members themselves
CREATE TABLE IF NOT EXISTS business_personal_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES business_team_members(id) ON DELETE CASCADE,
  business_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  metric text NOT NULL DEFAULT 'custom',
  target_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'monthly',
  deadline date,
  visible_to_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE business_personal_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage their own personal objectives"
  ON business_personal_objectives FOR ALL
  USING (true)
  WITH CHECK (true);
