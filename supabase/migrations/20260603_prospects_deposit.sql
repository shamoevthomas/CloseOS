-- Ajoute le support des acomptes sur les prospects Sales
-- (CloseOS Sales — demande Cindy 2026-05-29)

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS deposit_to_refund BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_date DATE;

COMMENT ON COLUMN public.prospects.deposit_amount IS 'Montant de l''acompte en euros (NULL ou 0 = pas d''acompte)';
COMMENT ON COLUMN public.prospects.deposit_to_refund IS 'Si true, l''acompte sera remboursé une fois le plan de paiement mis en place';
COMMENT ON COLUMN public.prospects.deposit_date IS 'Date à laquelle l''acompte a été versé';
