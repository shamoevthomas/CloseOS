-- Add google_meet_link column to business_appointments
ALTER TABLE business_appointments ADD COLUMN IF NOT EXISTS google_meet_link text;
