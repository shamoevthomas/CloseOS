-- Add a rich-text "pitch" field to business_formulas.
-- Holds the full sales argument for an offer (benefits, detailed content,
-- guarantees, objection handling), authored in the formula modal's "Pitch" tab
-- and shown to closers in the CallRoom. Stored as sanitized HTML.
ALTER TABLE business_formulas
  ADD COLUMN IF NOT EXISTS pitch text;
