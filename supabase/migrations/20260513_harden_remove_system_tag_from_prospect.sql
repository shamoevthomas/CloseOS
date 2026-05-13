-- Add ownership check inside the SECURITY DEFINER RPC so callers can only
-- remove system tags on prospects they own (or as a team member of the owner).

CREATE OR REPLACE FUNCTION public.remove_system_tag_from_prospect(
  p_prospect_id bigint,
  p_tag_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prospect_owner uuid;
BEGIN
  SELECT user_id INTO v_prospect_owner
  FROM business_prospects
  WHERE id = p_prospect_id;

  IF v_prospect_owner IS NULL THEN
    RAISE EXCEPTION 'Prospect not found';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_prospect_owner <> auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM business_team_members
       WHERE business_owner_id = v_prospect_owner
         AND id = auth.uid()
     )
  THEN
    RAISE EXCEPTION 'Not authorized to modify this prospect';
  END IF;

  ALTER TABLE business_prospect_tags DISABLE TRIGGER trg_prevent_system_tag_unlink;
  DELETE FROM business_prospect_tags WHERE prospect_id = p_prospect_id AND tag_id = p_tag_id;
  ALTER TABLE business_prospect_tags ENABLE TRIGGER trg_prevent_system_tag_unlink;
END;
$$;
