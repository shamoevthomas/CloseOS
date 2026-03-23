-- Compensation type and fixed salary on team members
ALTER TABLE business_team_members
  ADD COLUMN IF NOT EXISTS compensation_type text DEFAULT 'commission',
  ADD COLUMN IF NOT EXISTS fixed_salary numeric DEFAULT 0;

-- Bonuses table: linked to invoices, activated when invoice is paid
CREATE TABLE IF NOT EXISTS business_team_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES business_team_members(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'en attente',
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz DEFAULT NULL
);

-- RLS
ALTER TABLE business_team_bonuses ENABLE ROW LEVEL SECURITY;

-- Owner can do everything on their team's bonuses
CREATE POLICY "owner_manage_bonuses" ON business_team_bonuses
  FOR ALL USING (
    business_owner_id = auth.uid()
  );

-- Team member can read their own bonuses
CREATE POLICY "member_read_own_bonuses" ON business_team_bonuses
  FOR SELECT USING (
    team_member_id IN (
      SELECT id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Head of Sales / Admin can read all bonuses for their org
CREATE POLICY "hos_admin_read_bonuses" ON business_team_bonuses
  FOR SELECT USING (
    business_owner_id IN (
      SELECT business_owner_id FROM business_team_members
      WHERE user_id = auth.uid() AND role IN ('Head of Sales', 'Admin')
    )
  );
