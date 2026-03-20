-- Custom role permissions stored as JSONB on team members and invitations
-- Format: { "pages": { "crm": { "access": true, "write": true, "assign": true }, ... } }
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS custom_permissions jsonb DEFAULT NULL;
ALTER TABLE business_invitations ADD COLUMN IF NOT EXISTS custom_permissions jsonb DEFAULT NULL;
