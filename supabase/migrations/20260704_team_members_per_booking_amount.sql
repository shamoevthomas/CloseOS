-- Fixe par RDV booké pour les Setters / Setter-Closers.
-- Montant fixe (en €) gagné par le setter à chaque RDV booké, cumulable avec les commissions.
ALTER TABLE business_team_members
  ADD COLUMN IF NOT EXISTS per_booking_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN business_team_members.per_booking_amount IS
  'Rémunération fixe (€) gagnée par le setter/setter-closer à chaque RDV booké. Distinct des commissions.';
