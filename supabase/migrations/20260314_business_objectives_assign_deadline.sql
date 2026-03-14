-- Migration: add assigned_to and deadline to business_objectives

ALTER TABLE business_objectives ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES business_team_members(id) ON DELETE SET NULL;
ALTER TABLE business_objectives ADD COLUMN IF NOT EXISTS deadline date;
