-- ============================================
-- CloseOS Business - Campaigns & Appointments
-- ============================================

-- 1. business_campaigns
CREATE TABLE IF NOT EXISTS business_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source text DEFAULT 'Direct',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  slug text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own campaigns"
  ON business_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns"
  ON business_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON business_campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON business_campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Public read by slug (for capture form)
CREATE POLICY "Anyone can read active campaign by slug"
  ON business_campaigns FOR SELECT
  USING (is_active = true);

-- 2. business_appointments
CREATE TABLE IF NOT EXISTS business_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES business_campaigns(id) ON DELETE SET NULL,
  prospect_id bigint REFERENCES business_prospects(id) ON DELETE CASCADE,
  date date NOT NULL,
  time time NOT NULL,
  duration integer DEFAULT 30,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own appointments"
  ON business_appointments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own appointments"
  ON business_appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own appointments"
  ON business_appointments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own appointments"
  ON business_appointments FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Add campaign_id to business_prospects
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES business_campaigns(id) ON DELETE SET NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE business_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE business_appointments;
