SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000000091","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

INSERT INTO public.audit_logs (
  user_id,
  action,
  entity_name,
  status,
  details
)
VALUES (
  'c0de0000-0000-4000-8000-000000000091',
  'MCP_TOOL:fixture',
  'MCP_SERVER',
  'SUCCESS',
  '{"user_role":"BDO","fixture":"mcp-audit-persistence-test"}'::jsonb
);

DO $$
DECLARE
  denied boolean;
BEGIN
  denied := false;
  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_name,
      status,
      details
    )
    VALUES (
      'c0de0000-0000-4000-8000-000000000092',
      'MCP_TOOL:fixture',
      'MCP_SERVER',
      'SUCCESS',
      '{"fixture":"mcp-audit-persistence-test"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Authenticated caller inserted another user audit row';
  END IF;

  denied := false;
  BEGIN
    PERFORM count(*) FROM public.audit_logs;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Authenticated caller can read audit rows';
  END IF;

  denied := false;
  BEGIN
    UPDATE public.audit_logs SET status = 'FAILED';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Authenticated caller can update audit rows';
  END IF;

  denied := false;
  BEGIN
    DELETE FROM public.audit_logs;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Authenticated caller can delete audit rows';
  END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;

DO $$
DECLARE
  denied boolean;
BEGIN
  denied := false;
  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_name,
      status,
      details
    )
    VALUES (
      'c0de0000-0000-4000-8000-000000000091',
      'MCP_TOOL:fixture',
      'MCP_SERVER',
      'SUCCESS',
      '{"fixture":"mcp-audit-persistence-test"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Anonymous caller inserted an audit row';
  END IF;

  denied := false;
  BEGIN
    PERFORM count(*) FROM public.audit_logs;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Anonymous caller can read audit rows';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.audit_logs
    WHERE details ->> 'fixture' = 'mcp-audit-persistence-test'
  ) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one owner-bound synthetic audit row';
  END IF;

  IF has_table_privilege('authenticated', 'public.audit_logs', 'SELECT')
    OR has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.audit_logs', 'DELETE')
    OR has_table_privilege('anon', 'public.audit_logs', 'INSERT')
    OR has_table_privilege('anon', 'public.audit_logs', 'SELECT') THEN
    RAISE EXCEPTION 'Audit table has unexpected role grants';
  END IF;
END;
$$;
