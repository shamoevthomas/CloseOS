-- Business : page de confirmation personnalisable des campagnes
-- (titre, message, couleurs, vidéo, boutons, questionnaire avant RDV)
ALTER TABLE business_campaigns
  ADD COLUMN IF NOT EXISTS confirmation_page jsonb;

-- Réponses au questionnaire de la page de confirmation :
-- [{ campaign_id, title, answered_at, answers: [{ question, answer }] }]
ALTER TABLE business_prospects
  ADD COLUMN IF NOT EXISTS pre_meeting_answers jsonb;
