-- Le propriétaire peut activer/désactiver ses clés API (business_webhook_keys).
-- La RLS existante couvrait SELECT / INSERT / DELETE mais pas UPDATE :
-- le toggle actif/inactif de la section MCP des paramètres en a besoin.
CREATE POLICY "Owner can update own webhook keys"
  ON business_webhook_keys FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
