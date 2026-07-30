-- Retour en "Contacté" = boucle de relance repartie de zéro, + auto-réparation.
--
-- 1) Entrée (ou ré-entrée) dans le stage 'contacted' : le trigger réinitialise contacted_at,
--    relance_step, ET l'état "répondu"/discussion/dernière relance, afin qu'un prospect ayant
--    déjà répondu et remis en "Contacté" reparte des relances depuis la n°1.
-- 2) Auto-réparation : si un prospect est en 'contacted' mais SANS ancre contacted_at
--    (données historiques / imports en masse qui ont contourné le trigger), on la pose au
--    prochain update pour que le badge de relance et le cron d'emails fonctionnent.
CREATE OR REPLACE FUNCTION public.set_contacted_at() RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'contacted' THEN
    IF (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'contacted') THEN
      NEW.contacted_at := now();
      NEW.relance_step := 0;
      NEW.last_relance_at := NULL;
      NEW.responded_at := NULL;
      NEW.discussion_next_at := NULL;
      NEW.discussion_email_sent := false;
    ELSIF NEW.contacted_at IS NULL THEN
      NEW.contacted_at := COALESCE(NEW.last_contact, NEW.created_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill des prospects déjà en 'contacted' sans ancre (clock de relance neuf, pas d'email rétroactif).
UPDATE business_prospects
   SET contacted_at = now(), relance_step = 0, last_relance_at = NULL
 WHERE stage = 'contacted' AND contacted_at IS NULL;
