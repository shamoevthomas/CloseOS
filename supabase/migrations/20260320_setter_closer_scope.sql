-- Setter-Closer scope: 'self' = set for themselves only, 'all' = set for everyone
ALTER TABLE business_invitations ADD COLUMN IF NOT EXISTS setter_scope text;
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS setter_scope text;
