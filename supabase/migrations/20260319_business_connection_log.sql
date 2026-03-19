-- Connection/disconnection log for team members
CREATE TABLE IF NOT EXISTS business_connection_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES business_team_members(id) ON DELETE CASCADE,
  business_owner_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('connect', 'disconnect')),
  created_at timestamptz DEFAULT now()
);

-- Add pay_day column to business_team_members if not exists
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS pay_day integer DEFAULT NULL;

-- Enable RLS
ALTER TABLE business_connection_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connection_log_all" ON business_connection_log FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE business_connection_log;
