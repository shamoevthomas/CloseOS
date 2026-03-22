-- Tags system for prospects
CREATE TABLE IF NOT EXISTS business_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, name)
);

CREATE TABLE IF NOT EXISTS business_prospect_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id bigint NOT NULL REFERENCES business_prospects(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES business_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(prospect_id, tag_id)
);

-- RLS
ALTER TABLE business_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_prospect_tags ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own tags
CREATE POLICY "owner_manage_tags" ON business_tags
  FOR ALL USING (owner_id = auth.uid());

-- Team members can read owner's tags
CREATE POLICY "team_read_tags" ON business_tags
  FOR SELECT USING (
    owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE id = auth.uid()
    )
  );

-- Team members can insert tags for their owner
CREATE POLICY "team_insert_tags" ON business_tags
  FOR INSERT WITH CHECK (
    owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE id = auth.uid()
    )
  );

-- Prospect tags: owner access
CREATE POLICY "owner_manage_prospect_tags" ON business_prospect_tags
  FOR ALL USING (
    prospect_id IN (
      SELECT id FROM business_prospects WHERE user_id = auth.uid()
    )
  );

-- Prospect tags: team member access
CREATE POLICY "team_manage_prospect_tags" ON business_prospect_tags
  FOR ALL USING (
    prospect_id IN (
      SELECT bp.id FROM business_prospects bp
      JOIN business_team_members btm ON btm.business_owner_id = bp.user_id
      WHERE btm.id = auth.uid()
    )
  );

-- Index for performance
CREATE INDEX idx_business_tags_owner ON business_tags(owner_id);
CREATE INDEX idx_business_prospect_tags_prospect ON business_prospect_tags(prospect_id);
CREATE INDEX idx_business_prospect_tags_tag ON business_prospect_tags(tag_id);
