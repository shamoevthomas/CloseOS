-- Soft lock on a slot while a Stripe PaymentIntent is in flight.
-- An appointment is created with status='pending_payment' and a TTL.
-- If payment confirms → flip to 'upcoming'. If it expires/cancels → row is deleted.

ALTER TABLE business_appointments
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;

-- Drop the legacy CHECK constraint that didn't include 'upcoming' / 'pending_payment'
ALTER TABLE business_appointments
  DROP CONSTRAINT IF EXISTS business_appointments_status_check;

ALTER TABLE business_appointments
  ADD CONSTRAINT business_appointments_status_check
  CHECK (status IN ('pending', 'pending_payment', 'upcoming', 'confirmed', 'cancelled', 'done', 'no_show'));

-- Index to speed up cleanup of expired pending_payment rows
CREATE INDEX IF NOT EXISTS business_appointments_pending_payment_idx
  ON business_appointments (status, payment_expires_at)
  WHERE status = 'pending_payment';

-- Link campaign_payment_sessions to appointment for the soft-lock flow
ALTER TABLE campaign_payment_sessions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS campaign_payment_sessions_pi_idx
  ON campaign_payment_sessions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
