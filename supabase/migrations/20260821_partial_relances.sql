-- ─── Relances automatiques par email sur les leads « Incomplet » (stage 'partial') ───
--
-- Un lead « Incomplet » est créé par capture-partial : il a laissé ses coordonnées
-- mais n'a pas terminé le formulaire de campagne. Il porte stage = 'partial' et le
-- tag système « Incomplet », tous deux retirés dès qu'il complète.
--
-- Même mécanique que les relances No Show, à une différence près : le bouton de
-- l'email pointe vers une CAMPAGNE (/capture/:slug) et non vers un lien de booking.
--
-- Règle de calcul des échéances (identique au No Show) :
--   • relance 1      → delay_days après l'entrée en « Incomplet »  (partial_at)
--   • relances 2..7  → delay_days après l'envoi de la RELANCE 1    (partial_first_relance_at)

-- 1) Horodatages sur le prospect
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS partial_at timestamptz;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS partial_first_relance_at timestamptz;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS partial_relance_step int NOT NULL DEFAULT 0;

-- Trigger : (ré)initialise le cycle à chaque entrée dans 'partial'
CREATE OR REPLACE FUNCTION set_partial_at() RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'partial' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'partial') THEN
    NEW.partial_at := now();
    NEW.partial_first_relance_at := NULL;
    NEW.partial_relance_step := 0;
  END IF;
  -- Le lead a complété (ou a été déplacé) : on coupe la séquence en cours
  IF TG_OP = 'UPDATE' AND OLD.stage = 'partial' AND NEW.stage IS DISTINCT FROM 'partial' THEN
    NEW.partial_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_partial_at ON business_prospects;
CREATE TRIGGER trg_set_partial_at
  BEFORE INSERT OR UPDATE ON business_prospects
  FOR EACH ROW EXECUTE FUNCTION set_partial_at();

-- Contrairement au No Show, on arme l'existant : les leads déjà « Incomplet » sont
-- justement la cible de la fonctionnalité, et ils ne partiront de toute façon
-- qu'une fois des relances configurées par le propriétaire.
UPDATE business_prospects SET partial_at = created_at
  WHERE stage = 'partial' AND partial_at IS NULL;

-- 2) Configuration des relances (max 7, ordonnées par position)
CREATE TABLE IF NOT EXISTS business_partial_relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position >= 1 AND position <= 7),
  delay_days int NOT NULL CHECK (delay_days >= 0 AND delay_days <= 60),
  subject text NOT NULL DEFAULT 'Vous n''avez pas terminé',
  body text NOT NULL DEFAULT '',
  -- Campagne ciblée par le bouton. NULL + use_origin_campaign = on renvoie le lead
  -- vers la campagne qu'il a lui-même abandonnée.
  campaign_id uuid REFERENCES business_campaigns(id) ON DELETE SET NULL,
  use_origin_campaign boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_owner_id, position)
);

ALTER TABLE business_partial_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON business_partial_relances
  FOR ALL USING (business_owner_id = auth.uid()) WITH CHECK (business_owner_id = auth.uid());

CREATE POLICY team_read ON business_partial_relances
  FOR SELECT USING (
    business_owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- 3) Journal des envois (anti-doublon : une relance par prospect et par entrée en 'partial')
CREATE TABLE IF NOT EXISTS business_partial_relance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relance_id uuid NOT NULL REFERENCES business_partial_relances(id) ON DELETE CASCADE,
  prospect_id bigint NOT NULL REFERENCES business_prospects(id) ON DELETE CASCADE,
  partial_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relance_id, prospect_id, partial_at)
);

ALTER TABLE business_partial_relance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_read ON business_partial_relance_logs
  FOR SELECT USING (
    relance_id IN (SELECT id FROM business_partial_relances WHERE business_owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_partial_relance_logs_lookup
  ON business_partial_relance_logs (relance_id, prospect_id, partial_at);

CREATE INDEX IF NOT EXISTS idx_business_prospects_partial
  ON business_prospects (user_id, partial_at) WHERE stage = 'partial';
