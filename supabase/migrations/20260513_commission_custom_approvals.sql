-- =================================================================
-- Commission inhabituelle + Échéancier custom + Validation HOS
-- =================================================================
-- Permet à un closer de :
--   1) saisir un taux de commission différent du standard
--   2) saisir un échéancier de paiement libre (montants par mois custom)
-- Côté Business, ces deux exceptions déclenchent un workflow de validation
-- par le owner / Head of Sales / Admin avant que la facture puisse être
-- générée.

-- ─── 1. Colonnes Sales (prospects + crm_prospects) ────────────────
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS custom_commission_rate numeric,
  ADD COLUMN IF NOT EXISTS installments_schedule jsonb;

COMMENT ON COLUMN prospects.custom_commission_rate IS 'Taux % saisi manuellement par le closer (null = taux standard de l''offre)';
COMMENT ON COLUMN prospects.installments_schedule IS 'Échéancier libre [{month: int, amount: numeric}] (null = division égale standard)';

ALTER TABLE crm_prospects
  ADD COLUMN IF NOT EXISTS custom_commission_rate numeric,
  ADD COLUMN IF NOT EXISTS installments_schedule jsonb,
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS installments integer;

-- ─── 2. Colonnes Business (business_prospects) ─────────────────────
ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS custom_commission_rate numeric,
  ADD COLUMN IF NOT EXISTS installments_schedule jsonb,
  ADD COLUMN IF NOT EXISTS commission_approval_status text,
  ADD COLUMN IF NOT EXISTS commission_approval_id uuid;

COMMENT ON COLUMN business_prospects.custom_commission_rate IS 'Taux % saisi manuellement par le closer';
COMMENT ON COLUMN business_prospects.installments_schedule IS 'Échéancier libre [{month, amount}]';
COMMENT ON COLUMN business_prospects.commission_approval_status IS 'pending|approved|rejected (null = standard, pas de validation requise)';

-- ─── 3. Table commission_approvals (Business uniquement) ───────────
CREATE TABLE IF NOT EXISTS commission_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id bigint NOT NULL REFERENCES business_prospects(id) ON DELETE CASCADE,
  closer_id uuid NOT NULL REFERENCES business_team_members(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('commission', 'schedule', 'both')),
  sale_amount numeric NOT NULL,
  standard_commission_rate numeric NOT NULL,
  custom_commission_rate numeric,
  installments_schedule jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES auth.users(id),
  rejection_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_approvals_owner_status
  ON commission_approvals (business_owner_id, status);

CREATE INDEX IF NOT EXISTS idx_commission_approvals_prospect
  ON commission_approvals (prospect_id);

CREATE INDEX IF NOT EXISTS idx_commission_approvals_closer
  ON commission_approvals (closer_id);

-- ─── 4. FK croisée business_prospects -> commission_approvals ──────
-- (séparée pour éviter le cycle de création)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'business_prospects_commission_approval_fk'
  ) THEN
    ALTER TABLE business_prospects
      ADD CONSTRAINT business_prospects_commission_approval_fk
      FOREIGN KEY (commission_approval_id)
      REFERENCES commission_approvals(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 5. RLS commission_approvals ───────────────────────────────────
ALTER TABLE commission_approvals ENABLE ROW LEVEL SECURITY;

-- SELECT : owner du business, OU closer concerné, OU HOS/Admin du business
DROP POLICY IF EXISTS "Commission approvals visible by owner, closer, HOS, admin" ON commission_approvals;
CREATE POLICY "Commission approvals visible by owner, closer, HOS, admin"
  ON commission_approvals FOR SELECT
  USING (
    auth.uid() = business_owner_id
    OR EXISTS (
      SELECT 1 FROM business_team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.business_owner_id = commission_approvals.business_owner_id
        AND (tm.role IN ('Head of Sales', 'Admin') OR tm.id = commission_approvals.closer_id)
    )
  );

-- INSERT : un team member peut créer une demande pour son propre business
DROP POLICY IF EXISTS "Team members can create approvals in their business" ON commission_approvals;
CREATE POLICY "Team members can create approvals in their business"
  ON commission_approvals FOR INSERT
  WITH CHECK (
    auth.uid() = business_owner_id
    OR EXISTS (
      SELECT 1 FROM business_team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.business_owner_id = commission_approvals.business_owner_id
    )
  );

-- UPDATE : seulement owner + HOS + Admin peuvent décider
DROP POLICY IF EXISTS "Owner, HOS, Admin can decide approvals" ON commission_approvals;
CREATE POLICY "Owner, HOS, Admin can decide approvals"
  ON commission_approvals FOR UPDATE
  USING (
    auth.uid() = business_owner_id
    OR EXISTS (
      SELECT 1 FROM business_team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.business_owner_id = commission_approvals.business_owner_id
        AND tm.role IN ('Head of Sales', 'Admin')
    )
  );

-- ─── 6. Realtime pour pastille sidebar ──────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE commission_approvals;
