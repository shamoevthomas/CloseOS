-- ═══════════════════════════════════════════════════════════════════════
-- Migration: business_revenue
-- Adds Stripe subscription tracking to business_prospects
-- Creates business_charges table for manual cost entries
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Add Stripe subscription columns to business_prospects
ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_amount numeric,
  ADD COLUMN IF NOT EXISTS subscription_interval text,
  ADD COLUMN IF NOT EXISTS matched_via text,
  ADD COLUMN IF NOT EXISTS last_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS next_payment_date timestamptz;

-- 2. Create business_charges table
CREATE TABLE IF NOT EXISTS business_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('fixed', 'variable')),
  month date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient monthly queries
CREATE INDEX IF NOT EXISTS idx_business_charges_owner_month
  ON business_charges(business_owner_id, month);

-- 3. RLS for business_charges
ALTER TABLE business_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage own charges"
  ON business_charges FOR ALL
  USING (auth.uid() = business_owner_id)
  WITH CHECK (auth.uid() = business_owner_id);
