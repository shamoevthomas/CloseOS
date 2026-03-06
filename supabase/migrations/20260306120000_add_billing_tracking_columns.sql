-- Ajout des colonnes manquantes pour le suivi complet des abonnements
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT NULL,        -- 'monthly' ou 'yearly'
ADD COLUMN IF NOT EXISTS subscribed_at timestamptz DEFAULT NULL, -- Date du premier paiement
ADD COLUMN IF NOT EXISTS has_voip boolean DEFAULT false;         -- Option VoIP activée
