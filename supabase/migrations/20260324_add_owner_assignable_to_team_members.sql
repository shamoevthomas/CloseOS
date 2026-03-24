-- Add owner_assignable flag to business_team_members (for HOS)
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS owner_assignable boolean DEFAULT false;
