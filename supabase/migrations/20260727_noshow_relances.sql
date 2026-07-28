-- ─── Relances automatiques par email sur le stage "No Show" ───
--
-- Différence avec les relances "Contacté" : celles-ci partent AU PROSPECT
-- (et non en digest au closer), avec un texte et un lien de booking choisis
-- par le propriétaire, jusqu'à 7 relances.
--
-- Règle de calcul des échéances (voulue par le produit) :
--   • relance 1      → delay_days après l'entrée en "No Show"  (noshow_at)
--   • relances 2..7  → delay_days après l'envoi de la RELANCE 1 (noshow_first_relance_at)
-- Les relances suivantes ne s'enchaînent donc pas les unes aux autres :
-- elles se calent toutes sur la première.

-- 1) Horodatages sur le prospect
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS noshow_at timestamptz;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS noshow_first_relance_at timestamptz;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS noshow_relance_step int NOT NULL DEFAULT 0;

-- Les prospects déjà en "no show" ne reçoivent PAS de relance rétroactive :
-- on ne renseigne pas noshow_at pour l'existant (sinon envoi massif au 1er cron).

-- Trigger : (ré)initialise le cycle à chaque entrée dans 'noshow'
CREATE OR REPLACE FUNCTION set_noshow_at() RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'noshow' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'noshow') THEN
    NEW.noshow_at := now();
    NEW.noshow_first_relance_at := NULL;
    NEW.noshow_relance_step := 0;
  END IF;
  -- Sortie du stage : on coupe la séquence en cours
  IF TG_OP = 'UPDATE' AND OLD.stage = 'noshow' AND NEW.stage IS DISTINCT FROM 'noshow' THEN
    NEW.noshow_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_noshow_at ON business_prospects;
CREATE TRIGGER trg_set_noshow_at
  BEFORE INSERT OR UPDATE ON business_prospects
  FOR EACH ROW EXECUTE FUNCTION set_noshow_at();

-- 2) Configuration des relances (max 7, ordonnées par position)
CREATE TABLE IF NOT EXISTS business_noshow_relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position >= 1 AND position <= 7),
  delay_days int NOT NULL CHECK (delay_days >= 0 AND delay_days <= 60),
  subject text NOT NULL DEFAULT 'On vous a manqué',
  body text NOT NULL DEFAULT '',
  booking_link_id uuid REFERENCES business_booking_links(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_owner_id, position)
);

ALTER TABLE business_noshow_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON business_noshow_relances
  FOR ALL USING (business_owner_id = auth.uid()) WITH CHECK (business_owner_id = auth.uid());

CREATE POLICY team_read ON business_noshow_relances
  FOR SELECT USING (
    business_owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- 3) Journal des envois (anti-doublon : une relance par prospect et par entrée en 'noshow')
CREATE TABLE IF NOT EXISTS business_noshow_relance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relance_id uuid NOT NULL REFERENCES business_noshow_relances(id) ON DELETE CASCADE,
  prospect_id bigint NOT NULL REFERENCES business_prospects(id) ON DELETE CASCADE,
  noshow_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relance_id, prospect_id, noshow_at)
);

ALTER TABLE business_noshow_relance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_read ON business_noshow_relance_logs
  FOR SELECT USING (
    relance_id IN (SELECT id FROM business_noshow_relances WHERE business_owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_noshow_relance_logs_lookup
  ON business_noshow_relance_logs (relance_id, prospect_id, noshow_at);

CREATE INDEX IF NOT EXISTS idx_business_prospects_noshow
  ON business_prospects (user_id, noshow_at) WHERE stage = 'noshow';
