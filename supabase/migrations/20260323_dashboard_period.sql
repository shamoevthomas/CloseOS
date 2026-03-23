-- Add dashboard_period column to business_settings
ALTER TABLE business_settings
ADD COLUMN IF NOT EXISTS dashboard_period TEXT DEFAULT 'all';
