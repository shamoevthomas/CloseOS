-- ============================================
-- CloseOS Business — Disponibilités temporaires
-- ============================================
-- Une "dispo temporaire" = une période datée (ex. du 15 au 22 août) qui
-- REMPLACE intégralement les créneaux hebdomadaires (business_availability_slots)
-- pour les jours couverts. Hors période, on retombe sur les créneaux de base.
--
-- Un jour sans créneau dans la période = indisponible (l'override est total,
-- pas un complément). Les absences (business_absences) restent prioritaires.
--
-- Les créneaux sont stockés en jsonb sur la période :
--   [{ "day_of_week": 0, "start_time": "09:00", "end_time": "12:00" }, ...]
-- day_of_week : 0 = lundi ... 6 = dimanche (même convention que les slots hebdo).
-- Un seul row à lire par période => une seule requête sur toutes les surfaces
-- de réservation (lien de booking, lien de capture, booking interne).

CREATE TABLE IF NOT EXISTS business_temporary_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  -- NULL = période de l'owner lui-même (même convention que les slots hebdo)
  team_member_id uuid REFERENCES business_team_members(id) ON DELETE CASCADE,
  label text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_temp_avail_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_business_temp_avail_owner
  ON business_temporary_availability(business_owner_id);
CREATE INDEX IF NOT EXISTS idx_business_temp_avail_member
  ON business_temporary_availability(team_member_id);
CREATE INDEX IF NOT EXISTS idx_business_temp_avail_end_date
  ON business_temporary_availability(end_date);

ALTER TABLE business_temporary_availability ENABLE ROW LEVEL SECURITY;

-- Mêmes règles que business_availability_slots : lecture publique (les pages
-- de booking publiques lisent en anon), écriture réservée à l'owner et au
-- membre concerné.
DROP POLICY IF EXISTS "Public can read temporary availability" ON business_temporary_availability;
CREATE POLICY "Public can read temporary availability"
  ON business_temporary_availability FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner can manage temporary availability" ON business_temporary_availability;
CREATE POLICY "Owner can manage temporary availability"
  ON business_temporary_availability FOR ALL
  USING (business_owner_id = auth.uid());

DROP POLICY IF EXISTS "Team member can manage own temporary availability" ON business_temporary_availability;
CREATE POLICY "Team member can manage own temporary availability"
  ON business_temporary_availability FOR ALL
  USING (team_member_id IN (
    SELECT id FROM business_team_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Team member can read colleague temporary availability" ON business_temporary_availability;
CREATE POLICY "Team member can read colleague temporary availability"
  ON business_temporary_availability FOR SELECT
  USING (business_owner_id IN (
    SELECT business_owner_id FROM business_team_members WHERE user_id = auth.uid()
  ));
