-- Business : tracking du parcours sur les pages de campagne (/capture/:slug)
-- Une ligne par visite (session navigateur) : étapes atteintes, questions de
-- qualification répondues, question où le visiteur bloque, et suivi de la page
-- de confirmation (visionnage des vidéos, questionnaire avant RDV).
CREATE TABLE IF NOT EXISTS campaign_funnel_sessions (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES business_campaigns(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  prospect_id bigint REFERENCES business_prospects(id) ON DELETE SET NULL,
  device text,
  reached text[] NOT NULL DEFAULT '{}',
  answered_question_ids text[] NOT NULL DEFAULT '{}',
  stuck_question_id text,
  completed boolean NOT NULL DEFAULT false,
  disqualified boolean NOT NULL DEFAULT false,
  confirmation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_funnel_sessions_campaign_idx ON campaign_funnel_sessions (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS campaign_funnel_sessions_prospect_idx ON campaign_funnel_sessions (prospect_id) WHERE prospect_id IS NOT NULL;

-- Accès uniquement via l'API (service role)
ALTER TABLE campaign_funnel_sessions ENABLE ROW LEVEL SECURITY;
