-- Campaign "passe par un setter" : when RDV is with a Closer, optionally also
-- route the lead through a Setter (a setter is assigned IN ADDITION to the closer).
-- The closer is always assigned; the RDV stays on the closer's agenda.
ALTER TABLE business_campaigns
  ADD COLUMN IF NOT EXISTS booking_via_setter boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS setter_assign_mode text DEFAULT 'all_role' CHECK (setter_assign_mode IN ('specific', 'all_role', 'multiple')),
  ADD COLUMN IF NOT EXISTS setter_assigned_members jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS setter_distribution text DEFAULT 'round_robin' CHECK (setter_distribution IN ('round_robin', 'random'));
