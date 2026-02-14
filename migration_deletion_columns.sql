ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_scope JSONB DEFAULT '[]'::jsonb;
