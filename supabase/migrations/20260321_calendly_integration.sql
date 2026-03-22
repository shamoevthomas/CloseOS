-- Add calendly_event_uri to business_appointments for linking back to Calendly events
ALTER TABLE business_appointments
ADD COLUMN IF NOT EXISTS calendly_event_uri text;

-- Index for fast lookup when Calendly sends cancellation webhooks
CREATE INDEX IF NOT EXISTS idx_business_appointments_calendly_uri
ON business_appointments (calendly_event_uri)
WHERE calendly_event_uri IS NOT NULL;
