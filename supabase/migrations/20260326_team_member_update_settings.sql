-- Allow team members to update their owner's business_settings (e.g. dashboard_period)
CREATE POLICY "Team members can update owner business settings"
  ON business_settings FOR UPDATE
  USING (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );
