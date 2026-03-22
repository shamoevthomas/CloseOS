-- Add phone column to business_team_members
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS phone text;

-- Allow team members to read their business owner's profile
CREATE POLICY "Team members can read their owner profile"
  ON business_users FOR SELECT
  USING (
    id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- Allow team members to update their own record (phone etc)
CREATE POLICY "Team members can update own record"
  ON business_team_members FOR UPDATE
  USING (auth.uid() = user_id);
