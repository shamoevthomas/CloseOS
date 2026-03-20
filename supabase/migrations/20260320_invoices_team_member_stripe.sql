-- Add team_member_id and stripe_payment_link to invoices for owner view
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS team_member_id uuid REFERENCES business_team_members(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link text;
