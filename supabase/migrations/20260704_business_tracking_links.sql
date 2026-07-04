-- ============================================
-- CloseOS Business - Tracking Links & Analytics
-- ============================================
-- Liens de tracking courts (/t/:slug) qui redirigent vers une
-- destination tout en enregistrant chaque clic : pays (géoloc IP
-- Vercel), visiteur récurrent/unique (cookie), referrer, et le
-- temps passé sur la page quand la destination est une page CloseOS.

-- 1. business_tracking_links
CREATE TABLE IF NOT EXISTS business_tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL DEFAULT substr(md5(gen_random_uuid()::text), 1, 8),
  destination_url text NOT NULL,
  is_internal boolean DEFAULT false,   -- destination = page CloseOS (temps sur page mesurable)
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_links_user ON business_tracking_links(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_slug ON business_tracking_links(slug);

ALTER TABLE business_tracking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tracking links"
  ON business_tracking_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracking links"
  ON business_tracking_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracking links"
  ON business_tracking_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracking links"
  ON business_tracking_links FOR DELETE
  USING (auth.uid() = user_id);

-- 2. business_tracking_events (un event = un clic)
CREATE TABLE IF NOT EXISTS business_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES business_tracking_links(id) ON DELETE CASCADE,
  visitor_id text,                     -- id de cookie 1st-party (récurrence)
  is_returning boolean DEFAULT false,
  country text,                        -- code ISO2 (ex: FR)
  city text,
  referrer text,
  user_agent text,
  duration_seconds integer,            -- rempli par le beacon (pages CloseOS uniquement)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_link ON business_tracking_events(link_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_link_visitor ON business_tracking_events(link_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_link_country ON business_tracking_events(link_id, country);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created ON business_tracking_events(created_at);

ALTER TABLE business_tracking_events ENABLE ROW LEVEL SECURITY;

-- Le propriétaire du lien peut lire ses events (écritures faites par la service-role côté serveur).
CREATE POLICY "Users can read own tracking events"
  ON business_tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_tracking_links l
      WHERE l.id = business_tracking_events.link_id
        AND l.user_id = auth.uid()
    )
  );
