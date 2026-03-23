-- When an invoice is marked as "payé", auto-mark linked bonuses as "payé"
CREATE OR REPLACE FUNCTION auto_pay_bonuses_on_invoice_paid()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'payé' AND (OLD.status IS DISTINCT FROM 'payé') THEN
    UPDATE business_team_bonuses
    SET status = 'payé', paid_at = now()
    WHERE invoice_id = NEW.id AND status != 'payé';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_pay_bonuses ON invoices;
CREATE TRIGGER trg_auto_pay_bonuses
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_pay_bonuses_on_invoice_paid();
