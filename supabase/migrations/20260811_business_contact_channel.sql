-- ============================================
-- CloseOS Business — Canal de contact (écrit / vocal / mail)
-- ============================================
-- À chaque prise de contact (premier contact ou relance), une pop-up demande
-- par quel canal le message a été envoyé. La réponse alimente les KPI setter
-- « taux de réponse par canal ».
--
-- Valeurs autorisées : 'written' (à l'écrit), 'voice' (vocal), 'email' (mail).
--
-- first_contact_channel : canal du passage en « Contacté ».
-- relance_channels      : canal de chaque relance, dans l'ordre.
--                         relance_channels[i] = canal de la relance n°(i+1),
--                         donc aligné sur relance_step (qui compte les relances faites).
--                         Une entrée vaut null si la question a été désactivée.

ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS first_contact_channel text,
  ADD COLUMN IF NOT EXISTS relance_channels jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_prospects_first_contact_channel_check'
  ) THEN
    ALTER TABLE business_prospects
      ADD CONSTRAINT business_prospects_first_contact_channel_check
      CHECK (first_contact_channel IS NULL OR first_contact_channel IN ('written', 'voice', 'email'));
  END IF;
END $$;

-- Le retour en « Contacté » réinitialise déjà contacted_at / relance_step /
-- responded_at (cf. 20260729_contacted_reentry_full_reset) : la boucle de relance
-- repart de zéro. On y ajoute relance_channels, sinon il resterait désaligné avec
-- relance_step (relance_channels[i] doit rester le canal de la relance n°(i+1)).
--
-- first_contact_channel n'est PAS remis à zéro ici : le client l'écrit dans la
-- même requête que le passage en « Contacté » (pop-up canal), un reset serveur
-- écraserait donc la valeur qu'on vient de poser.
CREATE OR REPLACE FUNCTION public.set_contacted_at() RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'contacted' THEN
    IF (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'contacted') THEN
      -- Entrée (ou ré-entrée) dans le stage : boucle repartie de zéro.
      NEW.contacted_at := now();
      NEW.relance_step := 0;
      NEW.last_relance_at := NULL;
      NEW.responded_at := NULL;
      NEW.discussion_next_at := NULL;
      NEW.discussion_email_sent := false;
      NEW.relance_channels := '[]'::jsonb;
    ELSIF NEW.contacted_at IS NULL THEN
      -- Déjà en "Contacté" mais sans ancre : on la pose pour que les relances fonctionnent.
      NEW.contacted_at := COALESCE(NEW.last_contact, NEW.created_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Préférences par utilisateur connecté
-- ============================================
-- Volontairement PAS dans business_settings : cette table est chargée par owner
-- (les membres lisent les réglages de l'owner), or « ne plus me poser la
-- question » est un choix individuel — un setter doit pouvoir la désactiver
-- sans l'imposer à toute l'organisation.

CREATE TABLE IF NOT EXISTS business_user_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ask_contact_channel boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE business_user_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can manage own prefs" ON business_user_prefs;
CREATE POLICY "User can manage own prefs"
  ON business_user_prefs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
