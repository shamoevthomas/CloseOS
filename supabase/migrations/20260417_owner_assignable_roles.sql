-- Owner assignable roles (Setter, Closer, or both)
ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS owner_assignable_roles text[] DEFAULT '{}';

ALTER TABLE business_team_members
  ADD COLUMN IF NOT EXISTS owner_assignable_roles text[] DEFAULT '{}';
