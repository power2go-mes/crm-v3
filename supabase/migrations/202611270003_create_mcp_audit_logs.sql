BEGIN;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action LIKE 'MCP_TOOL:%' AND length(action) <= 150),
  entity_name text NOT NULL CHECK (entity_name = 'MCP_SERVER'),
  status text NOT NULL CHECK (status IN ('SUCCESS', 'DENIED', 'FAILED')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_created_at_idx
  ON public.audit_logs (user_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert_own_mcp_events
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND action LIKE 'MCP_TOOL:%'
    AND entity_name = 'MCP_SERVER'
  );

REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT INSERT (user_id, action, entity_name, status, details)
  ON TABLE public.audit_logs
  TO authenticated;

COMMIT;
