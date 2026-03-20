-- Role-level commission rates per business
CREATE TABLE IF NOT EXISTS business_role_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  role text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_owner_id, role)
);

ALTER TABLE business_role_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage role commissions"
  ON business_role_commissions FOR ALL
  USING (auth.uid() = business_owner_id);

CREATE POLICY "Team members can read role commissions"
  ON business_role_commissions FOR SELECT
  USING (
    business_owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Per-member commission override (null = use role default)
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS commission_rate numeric;
