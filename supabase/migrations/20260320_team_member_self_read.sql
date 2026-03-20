-- Allow team members to always read their own record
CREATE POLICY "Team members can read own record"
ON business_team_members FOR SELECT
USING (auth.uid() = user_id);
