-- ============================================
-- CloseOS Business - Formulaires (builder type Tally)
-- ============================================
-- Un formulaire = une suite de BLOCS (jsonb) éditée dans un éditeur
-- type Notion, publiée sur /f/:slug. Les soumissions atterrissent dans
-- business_form_responses, et créent optionnellement un prospect CRM
-- (crm_enabled + crm_mapping).
--
-- Volontairement découplé de business_campaigns : un formulaire n'est
-- pas une campagne (pas de booking, pas d'assignation closer/setter).

-- 1. business_forms
CREATE TABLE IF NOT EXISTS business_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES business_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  slug text UNIQUE NOT NULL DEFAULT substr(md5(gen_random_uuid()::text), 1, 10),

  -- Contenu : tableau de blocs (voir src/lib/formBlocks.ts)
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Réglages : libellé du bouton, page de remerciement, redirection,
  -- couleur d'accent, barre de progression, une question à la fois
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_active boolean NOT NULL DEFAULT true,

  -- Pont CRM (optionnel, par formulaire)
  crm_enabled boolean NOT NULL DEFAULT false,
  -- { "name": "<block_id>", "email": "<block_id>", "phone": "<block_id>" }
  crm_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  crm_source text,
  crm_stage text,
  crm_campaign_id uuid REFERENCES business_campaigns(id) ON DELETE SET NULL,

  -- Notification à chaque réponse
  notify_enabled boolean NOT NULL DEFAULT false,
  notify_email text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_forms_user ON business_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_business_forms_slug ON business_forms(slug);

ALTER TABLE business_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own forms"
  ON business_forms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own forms"
  ON business_forms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own forms"
  ON business_forms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own forms"
  ON business_forms FOR DELETE
  USING (auth.uid() = user_id);

-- 2. business_form_responses (une ligne = une soumission)
CREATE TABLE IF NOT EXISTS business_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES business_forms(id) ON DELETE CASCADE,
  -- dénormalisé depuis business_forms pour permettre une RLS directe
  user_id uuid REFERENCES business_users(id) ON DELETE CASCADE,

  -- { "<block_id>": <valeur> }
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- champs cachés, utm, referrer, user agent
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- prospect créé quand crm_enabled (business_prospects.id est un bigint)
  prospect_id bigint REFERENCES business_prospects(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_form_responses_form ON business_form_responses(form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_form_responses_user ON business_form_responses(user_id);

ALTER TABLE business_form_responses ENABLE ROW LEVEL SECURITY;

-- Lecture/suppression par le propriétaire du formulaire.
-- Les insertions se font par la service-role côté serveur (page publique).
CREATE POLICY "Users can read own form responses"
  ON business_form_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own form responses"
  ON business_form_responses FOR DELETE
  USING (auth.uid() = user_id);
