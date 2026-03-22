-- Add owner_assignable flag to business_users
-- When true, the owner appears in assignment dropdowns alongside team members
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS owner_assignable boolean DEFAULT false;
