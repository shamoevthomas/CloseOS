-- Fix: allow deleting a business_prospects row even when it has system tags.
-- The existing trigger prevent_system_tag_unlink blocked the CASCADE delete on
-- business_prospect_tags, making any prospect with a system tag (e.g. "Incomplet")
-- impossible to delete.

CREATE OR REPLACE FUNCTION public.mark_cascade_prospect_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.cascade_prospect_delete', 'true', true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_cascade_prospect_delete ON public.business_prospects;
CREATE TRIGGER trg_mark_cascade_prospect_delete
BEFORE DELETE ON public.business_prospects
FOR EACH ROW
EXECUTE FUNCTION public.mark_cascade_prospect_delete();

CREATE OR REPLACE FUNCTION public.prevent_system_tag_unlink()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.cascade_prospect_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM business_tags WHERE id = OLD.tag_id AND is_system = true) THEN
    RAISE EXCEPTION 'Cannot remove system tag from prospect';
  END IF;
  RETURN OLD;
END;
$$;
