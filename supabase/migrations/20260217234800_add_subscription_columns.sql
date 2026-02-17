ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS plan text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_period_end timestamptz DEFAULT NULL;

-- Index pour les recherches rapides par customer_id (webhook)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
