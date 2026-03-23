-- Add issuer profile fields to business_team_members
ALTER TABLE business_team_members
ADD COLUMN IF NOT EXISTS issuer_company_name TEXT,
ADD COLUMN IF NOT EXISTS issuer_address TEXT,
ADD COLUMN IF NOT EXISTS issuer_city TEXT,
ADD COLUMN IF NOT EXISTS issuer_zip TEXT,
ADD COLUMN IF NOT EXISTS issuer_country TEXT DEFAULT 'France',
ADD COLUMN IF NOT EXISTS issuer_siret TEXT,
ADD COLUMN IF NOT EXISTS issuer_tva_number TEXT;

-- Add invoice detail columns
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS tva_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS issuer_name TEXT,
ADD COLUMN IF NOT EXISTS issuer_company TEXT,
ADD COLUMN IF NOT EXISTS issuer_address TEXT,
ADD COLUMN IF NOT EXISTS issuer_siret TEXT,
ADD COLUMN IF NOT EXISTS issuer_email TEXT,
ADD COLUMN IF NOT EXISTS issuer_phone TEXT,
ADD COLUMN IF NOT EXISTS receiver_name TEXT,
ADD COLUMN IF NOT EXISTS receiver_company TEXT,
ADD COLUMN IF NOT EXISTS receiver_address TEXT,
ADD COLUMN IF NOT EXISTS receiver_siret TEXT,
ADD COLUMN IF NOT EXISTS receiver_tva TEXT,
ADD COLUMN IF NOT EXISTS late_penalty_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_penalty_fixed NUMERIC DEFAULT 40,
ADD COLUMN IF NOT EXISTS payment_method TEXT;
