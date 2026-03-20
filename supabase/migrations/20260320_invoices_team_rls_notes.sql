-- Add notes column to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;

-- Team members can view invoices of their owner
CREATE POLICY "Team members can view owner invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_team_members
      WHERE business_team_members.user_id = auth.uid()
        AND business_team_members.business_owner_id = invoices.user_id
    )
  );

-- Team members can insert invoices for their owner
CREATE POLICY "Team members can insert owner invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_team_members
      WHERE business_team_members.user_id = auth.uid()
        AND business_team_members.business_owner_id = invoices.user_id
    )
  );

-- Team members can update invoices of their owner
CREATE POLICY "Team members can update owner invoices"
  ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM business_team_members
      WHERE business_team_members.user_id = auth.uid()
        AND business_team_members.business_owner_id = invoices.user_id
    )
  );
