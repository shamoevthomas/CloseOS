-- ============================================
-- Allow team members to read their owner's data
-- (prospects, campaigns, appointments, settings)
-- ============================================

-- Team members can read owner's prospects
CREATE POLICY "Team members can read owner prospects"
  ON business_prospects FOR SELECT
  USING (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can insert prospects for their owner
CREATE POLICY "Team members can insert owner prospects"
  ON business_prospects FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can update owner's prospects
CREATE POLICY "Team members can update owner prospects"
  ON business_prospects FOR UPDATE
  USING (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can read owner's campaigns
CREATE POLICY "Team members can read owner campaigns"
  ON business_campaigns FOR SELECT
  USING (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can read owner's appointments
CREATE POLICY "Team members can read owner appointments"
  ON business_appointments FOR SELECT
  USING (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can insert appointments for their owner
CREATE POLICY "Team members can insert owner appointments"
  ON business_appointments FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can update owner's appointments
CREATE POLICY "Team members can update owner appointments"
  ON business_appointments FOR UPDATE
  USING (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can read owner's settings
CREATE POLICY "Team members can read owner settings"
  ON business_settings FOR SELECT
  USING (
    user_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );
