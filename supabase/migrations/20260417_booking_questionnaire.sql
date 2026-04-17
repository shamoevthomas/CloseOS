-- Questionnaire config on booking links (JSONB — no scoring needed)
ALTER TABLE business_booking_links
  ADD COLUMN IF NOT EXISTS questionnaire_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS questionnaire_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS questionnaire_questions jsonb DEFAULT '[]'::jsonb;

-- Questionnaire answers on appointments
ALTER TABLE business_appointments
  ADD COLUMN IF NOT EXISTS questionnaire_answers jsonb;
