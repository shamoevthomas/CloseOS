-- 1. Make user_id nullable in business_referral_conversions
-- (the column stored a placeholder UUID '00000000-...' because the user doesn't exist yet at checkout time)
ALTER TABLE business_referral_conversions ALTER COLUMN user_id DROP NOT NULL;

-- 2. Clean up existing placeholder UUIDs
UPDATE business_referral_conversions SET user_id = NULL WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 3. Atomic increment function for purchased_seats (avoids race condition on concurrent seat purchases)
CREATE OR REPLACE FUNCTION increment_purchased_seats(p_user_id uuid, p_seats jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  key text;
  val int;
BEGIN
  UPDATE business_settings
  SET purchased_seats = (
    SELECT jsonb_object_agg(
      k,
      COALESCE((COALESCE(purchased_seats, '{}')::jsonb ->> k)::int, 0)
      + COALESCE((p_seats ->> k)::int, 0)
    )
    FROM (
      SELECT DISTINCT k FROM (
        SELECT jsonb_object_keys(COALESCE(purchased_seats, '{}')::jsonb) AS k
        UNION
        SELECT jsonb_object_keys(p_seats) AS k
      ) sub
    ) keys
  )
  WHERE user_id = p_user_id
  RETURNING purchased_seats INTO result;

  RETURN COALESCE(result, '{}');
END;
$$;
