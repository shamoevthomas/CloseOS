-- Per-formula commission rates (role-level and member-level overrides)
CREATE TABLE IF NOT EXISTS business_formula_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  formula_id uuid NOT NULL,
  role text,
  team_member_id uuid REFERENCES business_team_members(id) ON DELETE CASCADE,
  rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(formula_id, role, team_member_id)
);

ALTER TABLE business_formula_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage formula commissions"
  ON business_formula_commissions FOR ALL
  USING (auth.uid() = business_owner_id);

CREATE POLICY "Team members can read formula commissions"
  ON business_formula_commissions FOR SELECT
  USING (
    business_owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Per-member commission override column (kept for potential direct use)
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS commission_rate numeric;
