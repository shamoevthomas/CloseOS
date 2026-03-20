-- Add booking configuration columns to business_campaigns
ALTER TABLE business_campaigns
  ADD COLUMN IF NOT EXISTS booking_duration integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_title text,
  ADD COLUMN IF NOT EXISTS booking_description text,
  ADD COLUMN IF NOT EXISTS booking_with text DEFAULT 'closer' CHECK (booking_with IN ('closer', 'setter')),
  ADD COLUMN IF NOT EXISTS booking_assign_mode text DEFAULT 'all_role' CHECK (booking_assign_mode IN ('specific', 'all_role', 'multiple')),
  ADD COLUMN IF NOT EXISTS booking_assigned_members jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_distribution text DEFAULT 'round_robin' CHECK (booking_distribution IN ('round_robin', 'random'));
