-- Multi-booking: allow a prospect to book several slots in one go via a single booking link.
-- multi_booking_enabled: master toggle (owner-configured, free links only — incompatible with Stripe payment).
-- multi_booking_max: maximum number of slots a prospect can reserve at once (owner-configured, 2..10).
ALTER TABLE business_booking_links
  ADD COLUMN IF NOT EXISTS multi_booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS multi_booking_max integer NOT NULL DEFAULT 3;
