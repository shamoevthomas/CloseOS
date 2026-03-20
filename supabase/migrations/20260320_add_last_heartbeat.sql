-- Add last_heartbeat_at to business_team_members for reliable offline detection
ALTER TABLE business_team_members
ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz DEFAULT NULL;
