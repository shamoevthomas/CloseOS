-- Add dedicated loss_reason and loss_details columns to business_prospects
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE business_prospects ADD COLUMN IF NOT EXISTS loss_details text;
