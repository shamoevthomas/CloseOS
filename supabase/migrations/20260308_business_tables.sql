-- ============================================
-- CloseOS Business Tables
-- ============================================

-- 1. business_users
CREATE TABLE IF NOT EXISTS business_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  role text,
  avatar_url text,
  has_onboarded boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own business profile"
  ON business_users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own business profile"
  ON business_users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own business profile"
  ON business_users FOR UPDATE
  USING (auth.uid() = id);

-- 2. business_settings
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES business_users(id) ON DELETE CASCADE,
  company_name text,
  team_size text,
  niche text,
  niche_custom text,
  crm_provider text DEFAULT 'closeos',
  custom_roles jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own business settings"
  ON business_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business settings"
  ON business_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business settings"
  ON business_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. business_prospects (same structure as prospects)
CREATE TABLE IF NOT EXISTS business_prospects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  company text,
  contact text,
  "firstName" text,
  "lastName" text,
  email text,
  phone text,
  value numeric,
  offer text,
  offer_id bigint,
  title text,
  status text,
  stage text DEFAULT 'prospect',
  notes text,
  created_at timestamptz DEFAULT now(),
  last_contact timestamptz,
  formula_id text,
  payment_type text,
  installments integer,
  probability numeric,
  hubspot_contact_id text,
  call_notes jsonb
);

ALTER TABLE business_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own business prospects"
  ON business_prospects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business prospects"
  ON business_prospects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business prospects"
  ON business_prospects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own business prospects"
  ON business_prospects FOR DELETE
  USING (auth.uid() = user_id);

-- 4. business_invitations
CREATE TABLE IF NOT EXISTS business_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  role text,
  used boolean DEFAULT false,
  used_by uuid,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invitations"
  ON business_invitations FOR SELECT
  USING (auth.uid() = inviter_id OR token IS NOT NULL);

CREATE POLICY "Users can insert own invitations"
  ON business_invitations FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update invitations"
  ON business_invitations FOR UPDATE
  USING (true);

-- Public read for invitation validation
CREATE POLICY "Anyone can read invitation by token"
  ON business_invitations FOR SELECT
  USING (true);

-- 5. business_team_members
CREATE TABLE IF NOT EXISTS business_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  first_name text,
  last_name text,
  email text,
  is_online boolean DEFAULT false,
  joined_at timestamptz DEFAULT now()
);

ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their team"
  ON business_team_members FOR SELECT
  USING (auth.uid() = business_owner_id OR auth.uid() = user_id);

CREATE POLICY "Owners can insert team members"
  ON business_team_members FOR INSERT
  WITH CHECK (auth.uid() = business_owner_id);

CREATE POLICY "Owners can update team members"
  ON business_team_members FOR UPDATE
  USING (auth.uid() = business_owner_id);

CREATE POLICY "Owners can delete team members"
  ON business_team_members FOR DELETE
  USING (auth.uid() = business_owner_id);

-- Enable realtime for business_prospects
ALTER PUBLICATION supabase_realtime ADD TABLE business_prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE business_team_members;
