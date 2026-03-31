-- Link Sales profiles to Business organizations
-- business_member_id = the user's team_member record in the org
-- business_owner_id = shortcut to the org owner (for fast queries)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_member_id uuid REFERENCES business_team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_owner_id uuid REFERENCES business_users(id) ON DELETE SET NULL;
