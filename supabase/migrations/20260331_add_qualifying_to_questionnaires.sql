-- Add qualifying toggle to campaign_questionnaires
-- When false, answers are saved but not scored/used for disqualification
ALTER TABLE campaign_questionnaires
  ADD COLUMN IF NOT EXISTS qualifying boolean NOT NULL DEFAULT true;
