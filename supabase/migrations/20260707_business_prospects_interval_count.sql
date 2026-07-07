-- Stripe: capture the billing interval_count so quarterly/semester subs (interval=month, count=3/6)
-- are no longer mistaken for monthly. Additive: subscription_interval keeps its 'month'/'year' value.
ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS subscription_interval_count integer DEFAULT 1;
