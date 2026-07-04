-- Nombre de relances déjà marquées "faites" par le commercial (avance manuelle du tag)
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS relance_step int NOT NULL DEFAULT 0;

-- Le trigger d'entrée en "Contacté" (ré)initialise aussi le compteur de relances
CREATE OR REPLACE FUNCTION set_contacted_at() RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'contacted' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'contacted') THEN
    NEW.contacted_at := now();
    NEW.relance_step := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
