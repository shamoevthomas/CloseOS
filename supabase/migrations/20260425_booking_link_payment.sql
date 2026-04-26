-- Stripe payment config on booking links (mirrors business_campaigns)
ALTER TABLE business_booking_links
  ADD COLUMN IF NOT EXISTS stripe_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_currency text NOT NULL DEFAULT 'eur',
  ADD COLUMN IF NOT EXISTS refund_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reschedule_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reschedule_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reschedule_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_currency text NOT NULL DEFAULT 'eur';

-- Generalize campaign_payment_sessions to also handle booking links
ALTER TABLE campaign_payment_sessions
  ALTER COLUMN campaign_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS booking_link_id uuid REFERENCES business_booking_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_payment_sessions_booking_link_idx
  ON campaign_payment_sessions (booking_link_id, status)
  WHERE booking_link_id IS NOT NULL;
