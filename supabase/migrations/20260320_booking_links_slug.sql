-- Add slug column to business_booking_links for native CloseOS booking pages
ALTER TABLE business_booking_links ADD COLUMN IF NOT EXISTS slug text UNIQUE;
UPDATE business_booking_links SET slug = gen_random_uuid()::text WHERE slug IS NULL;
ALTER TABLE business_booking_links ALTER COLUMN slug SET NOT NULL;
