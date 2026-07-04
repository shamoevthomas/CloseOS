-- ─── Relances automatiques sur le stage "Contacté" ───

-- 1) Horodatage d'entrée dans le stage 'contacted'
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

-- Backfill des prospects déjà en 'contacted'
UPDATE business_prospects
  SET contacted_at = COALESCE(last_contact, now())
  WHERE stage = 'contacted' AND contacted_at IS NULL;

-- Trigger: (ré)initialise contacted_at à chaque entrée dans 'contacted'
CREATE OR REPLACE FUNCTION set_contacted_at() RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'contacted' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'contacted') THEN
    NEW.contacted_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_contacted_at ON business_prospects;
CREATE TRIGGER trg_set_contacted_at
  BEFORE INSERT OR UPDATE ON business_prospects
  FOR EACH ROW EXECUTE FUNCTION set_contacted_at();

-- 2) Configuration des relances (délais en jours, par owner)
CREATE TABLE IF NOT EXISTS business_contacted_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  days int NOT NULL CHECK (days >= 1 AND days <= 60),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_contacted_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON business_contacted_reminders
  FOR ALL USING (business_owner_id = auth.uid()) WITH CHECK (business_owner_id = auth.uid());

CREATE POLICY team_read ON business_contacted_reminders
  FOR SELECT USING (
    business_owner_id IN (
      SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
    )
  );

-- 3) Journal des envois (anti-doublon: une relance par prospect par entrée en 'contacted')
CREATE TABLE IF NOT EXISTS business_contacted_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES business_contacted_reminders(id) ON DELETE CASCADE,
  prospect_id bigint NOT NULL REFERENCES business_prospects(id) ON DELETE CASCADE,
  contacted_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reminder_id, prospect_id, contacted_at)
);
ALTER TABLE business_contacted_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_read ON business_contacted_reminder_logs
  FOR SELECT USING (
    reminder_id IN (SELECT id FROM business_contacted_reminders WHERE business_owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_contacted_reminder_logs_lookup
  ON business_contacted_reminder_logs (reminder_id, prospect_id, contacted_at);
