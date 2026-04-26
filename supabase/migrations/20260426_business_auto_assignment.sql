-- =================================================================
-- Auto-assignment of prospects ingested from external CRMs (Business)
-- =================================================================
-- Adds:
--   1. business_prospects.source : provider id of the row's origin
--      ('iclosed', 'calendly', 'airtable', 'hubspot', 'pipedrive',
--       'ghl', 'zapier', 'make', 'n8n', 'systemeio', NULL otherwise)
--   2. business_settings.crm_auto_assignment : per-provider JSON config
--      Format:
--      {
--        "iclosed": {
--          "managed_by_crm": false,            -- user said "yes" to "votre CRM gère-t-il l'assignation ?"
--          "enabled": true,                     -- switch ON
--          "role": "closer" | "setter",
--          "mode": "round_robin" | "random" | "specific_one" | "specific_many",
--          "team_member_ids": ["uuid1", ...],   -- members to pick from
--          "rr_index": 0                        -- internal cursor for round-robin
--        },
--        "hubspot": { ... }
--      }
--   3. BEFORE INSERT trigger that picks assigned_to / assigned_setter
--      based on the per-source config.

ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS crm_auto_assignment jsonb DEFAULT '{}'::jsonb;

-- Trigger function: BEFORE INSERT on business_prospects
CREATE OR REPLACE FUNCTION public.auto_assign_business_prospect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg              jsonb;
  members          jsonb;
  member_count     int;
  rr_idx           int;
  picked_uid       uuid;
  picked_text      text;
  v_mode           text;
  v_role           text;
  v_managed        boolean;
  v_enabled        boolean;
  v_curr_settings  jsonb;
BEGIN
  -- Skip if already assigned (e.g. Calendly host-match path)
  IF NEW.assigned_to IS NOT NULL OR NEW.assigned_setter IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip when source is unknown
  IF NEW.source IS NULL OR NEW.source = '' THEN
    RETURN NEW;
  END IF;

  SELECT crm_auto_assignment
    INTO v_curr_settings
  FROM business_settings
  WHERE user_id = NEW.user_id;

  IF v_curr_settings IS NULL THEN
    RETURN NEW;
  END IF;

  cfg := v_curr_settings -> NEW.source;
  IF cfg IS NULL THEN
    RETURN NEW;
  END IF;

  v_managed := COALESCE((cfg ->> 'managed_by_crm')::boolean, false);
  IF v_managed THEN
    -- User said the CRM handles it — do nothing on our side
    RETURN NEW;
  END IF;

  v_enabled := COALESCE((cfg ->> 'enabled')::boolean, false);
  IF NOT v_enabled THEN
    RETURN NEW;
  END IF;

  members := cfg -> 'team_member_ids';
  IF members IS NULL OR jsonb_typeof(members) <> 'array' OR jsonb_array_length(members) = 0 THEN
    RETURN NEW;
  END IF;
  member_count := jsonb_array_length(members);

  v_mode := COALESCE(cfg ->> 'mode', 'round_robin');
  v_role := COALESCE(cfg ->> 'role', 'closer');

  IF v_mode = 'random' THEN
    rr_idx := floor(random() * member_count)::int;
  ELSIF v_mode = 'specific_one' THEN
    rr_idx := 0;
  ELSE
    -- round_robin OR specific_many → use stored cursor
    rr_idx := COALESCE((cfg ->> 'rr_index')::int, 0);
    IF rr_idx < 0 THEN rr_idx := 0; END IF;
    rr_idx := rr_idx % member_count;

    -- Bump cursor for next call. We rewrite the whole sub-object to avoid
    -- corrupting other providers' configs.
    UPDATE business_settings
    SET crm_auto_assignment = jsonb_set(
      crm_auto_assignment,
      ARRAY[NEW.source, 'rr_index'],
      to_jsonb((rr_idx + 1) % member_count),
      true
    )
    WHERE user_id = NEW.user_id;
  END IF;

  picked_text := members ->> rr_idx;
  IF picked_text IS NULL OR picked_text = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    picked_uid := picked_text::uuid;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;

  IF v_role = 'setter' THEN
    NEW.assigned_setter := picked_uid;
  ELSE
    NEW.assigned_to := picked_uid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_business_prospect_trg ON business_prospects;
CREATE TRIGGER auto_assign_business_prospect_trg
  BEFORE INSERT ON business_prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_business_prospect();
