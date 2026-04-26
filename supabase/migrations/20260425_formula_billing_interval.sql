-- Add billing_interval to business_formulas to support
-- monthly / quarterly / annual recurring offers (and keep one_time + quote).
-- Backward compatible: existing subscription rows default to 'monthly'.

ALTER TABLE business_formulas
  ADD COLUMN IF NOT EXISTS billing_interval TEXT;

-- Backfill existing subscription rows
UPDATE business_formulas
SET billing_interval = 'monthly'
WHERE billing_type = 'subscription' AND billing_interval IS NULL;

-- Optional: index for filtering
CREATE INDEX IF NOT EXISTS idx_business_formulas_billing
  ON business_formulas (user_id, billing_type, billing_interval);
