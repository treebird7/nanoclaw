CREATE TABLE IF NOT EXISTS toakbox_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_at timestamptz DEFAULT now(),
  from_agent text NOT NULL,
  action text NOT NULL,
  command text,
  decision text NOT NULL CHECK (decision IN ('WHITELIST', 'BLACKLIST', 'UNKNOWN', 'APPROVED', 'REJECTED')),
  outcome text,
  task_id text,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_toakbox_audit_from_agent ON toakbox_audit_log (from_agent);
CREATE INDEX IF NOT EXISTS idx_toakbox_audit_decision ON toakbox_audit_log (decision);
CREATE INDEX IF NOT EXISTS idx_toakbox_audit_requested_at ON toakbox_audit_log (requested_at DESC);

ALTER TABLE toakbox_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_audit_log" ON toakbox_audit_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_audit_log" ON toakbox_audit_log
  FOR INSERT TO service_role WITH CHECK (true);
