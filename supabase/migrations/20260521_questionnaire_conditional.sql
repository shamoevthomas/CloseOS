-- Conditional display rule on capture campaign questions
-- Shape: { enabled, source_id, operator, values } | null
-- enabled=false or null => always show
-- source_id references another campaign_questions.id within the same questionnaire
ALTER TABLE campaign_questions
  ADD COLUMN IF NOT EXISTS conditional jsonb;

COMMENT ON COLUMN campaign_questions.conditional IS
  'Conditional display rule: { enabled, source_id, operator, values } | null';
