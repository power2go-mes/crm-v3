-- Rollback-only security regression fixtures.
-- Run only against an explicitly designated disposable database, inside an outer transaction.
INSERT INTO auth.users(id, email) VALUES
  ('c0de0000-0000-4000-8000-000000008311', 'codex-report-asm-a@example.invalid'),
  ('c0de0000-0000-4000-8000-000000008312', 'codex-report-bdo-a@example.invalid'),
  ('c0de0000-0000-4000-8000-000000008313', 'codex-report-asm-b@example.invalid'),
  ('c0de0000-0000-4000-8000-000000008314', 'codex-report-bdo-b@example.invalid'),
  ('c0de0000-0000-4000-8000-000000008315', 'codex-report-no-reports@example.invalid');

INSERT INTO public.roles(id, name, is_canonical, hierarchy_rank)
VALUES ('CODEX_REPORT_NO_REPORTS', 'Rollback-only report denial fixture', false, 100);

INSERT INTO public.role_permissions(role_id, permission_id, is_granted)
VALUES ('CODEX_REPORT_NO_REPORTS', 'accounts.view', true);

INSERT INTO public.user_roles(user_id, role_id) VALUES
  ('c0de0000-0000-4000-8000-000000008311', 'ASM'),
  ('c0de0000-0000-4000-8000-000000008312', 'BDO'),
  ('c0de0000-0000-4000-8000-000000008313', 'ASM'),
  ('c0de0000-0000-4000-8000-000000008314', 'BDO'),
  ('c0de0000-0000-4000-8000-000000008315', 'CODEX_REPORT_NO_REPORTS');

INSERT INTO public.sales_regions(id, name, code)
VALUES ('c0de0000-0000-4000-8000-000000008321', 'Rollback-only report region', 'CODEX-REPORT');

INSERT INTO public.sales_reporting_relationships(user_id, manager_id, region_id) VALUES
  ('c0de0000-0000-4000-8000-000000008311', NULL, 'c0de0000-0000-4000-8000-000000008321'),
  ('c0de0000-0000-4000-8000-000000008312', 'c0de0000-0000-4000-8000-000000008311', 'c0de0000-0000-4000-8000-000000008321'),
  ('c0de0000-0000-4000-8000-000000008313', NULL, 'c0de0000-0000-4000-8000-000000008321'),
  ('c0de0000-0000-4000-8000-000000008314', 'c0de0000-0000-4000-8000-000000008313', 'c0de0000-0000-4000-8000-000000008321');

INSERT INTO public.accounts(id, name, account_owner_id, account_type) VALUES
  ('c0de0000-0000-4000-8000-000000008331', 'Report Fixture ASM A', 'c0de0000-0000-4000-8000-000000008311', 'customer_direct'),
  ('c0de0000-0000-4000-8000-000000008332', 'Report Fixture BDO A', 'c0de0000-0000-4000-8000-000000008312', 'customer_direct'),
  ('c0de0000-0000-4000-8000-000000008333', 'Report Fixture ASM B', 'c0de0000-0000-4000-8000-000000008313', 'customer_direct'),
  ('c0de0000-0000-4000-8000-000000008334', 'Report Fixture BDO B', 'c0de0000-0000-4000-8000-000000008314', 'customer_direct');

INSERT INTO public.activities(id, activity_type, subject, assigned_to_id, created_by_id) VALUES
  ('c0de0000-0000-4000-8000-000000008341', 'task', 'Report Fixture Task A', 'c0de0000-0000-4000-8000-000000008312', 'c0de0000-0000-4000-8000-000000008311'),
  ('c0de0000-0000-4000-8000-000000008342', 'task', 'Report Fixture Task B', 'c0de0000-0000-4000-8000-000000008314', 'c0de0000-0000-4000-8000-000000008313');

INSERT INTO public.crm_sales_quotas(
  id, user_id, period_type, period_start, period_end, target_amount, currency
) VALUES
  ('c0de0000-0000-4000-8000-000000008351', 'c0de0000-0000-4000-8000-000000008312', 'monthly', '2026-01-01', '2026-01-31', 1000, 'USD'),
  ('c0de0000-0000-4000-8000-000000008352', 'c0de0000-0000-4000-8000-000000008314', 'monthly', '2026-01-01', '2026-01-31', 2000, 'USD');

INSERT INTO public.crm_field_rules(definition_id, role_id, visible, editable)
SELECT id, 'BDO', false, false
FROM public.crm_field_definitions
WHERE module = 'accounts' AND key = 'account_type'
ON CONFLICT (definition_id, role_id)
DO UPDATE SET visible = false, editable = false;

DO $$
DECLARE
  v_result JSONB;
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.execute_custom_report(uuid,jsonb)', 'EXECUTE'),
    'Anonymous role still has report RPC execution';
  ASSERT has_function_privilege('authenticated', 'public.execute_custom_report(uuid,jsonb)', 'EXECUTE'),
    'Authenticated role lost report RPC execution';
END;
$$;

SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$
DECLARE
  v_denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.execute_custom_report(NULL, '{"primary_module":"accounts"}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'Anonymous report execution was accepted';
END;
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000008315","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.execute_custom_report(
      NULL,
      '{"primary_module":"accounts","sort_field":"created_at"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'User without reports.view was accepted';
END;
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000008312","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_denied BOOLEAN := false;
  v_result JSONB;
BEGIN
  v_result := public.execute_custom_report(
    NULL,
    '{"primary_module":"accounts","selected_columns":["account_type"],"filters":[{"field":"account_type","operator":"equals","value":"customer_direct"}],"sort_field":"created_at","group_by_field":"account_type","aggregations":[{"field":"account_type","func":"count"}]}'::jsonb
  );
  ASSERT NOT (v_result ? 'aggregations'),
    'Report returned an aggregate that could infer a hidden field';
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008332'
      AND row_data->'account_type' = 'null'::jsonb
  ), 'BDO report leaked a hidden account_type value';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' IN (
      'c0de0000-0000-4000-8000-000000008331',
      'c0de0000-0000-4000-8000-000000008333',
      'c0de0000-0000-4000-8000-000000008334'
    )
  ), 'BDO report crossed its owner/branch scope';

  BEGIN
    PERFORM public.execute_custom_report(
      NULL,
      '{"primary_module":"quotas","sort_field":"created_at"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'BDO accessed quotas without sales_targets.view';
  v_denied := false;

  BEGIN
    PERFORM public.execute_custom_report(
      NULL,
      '{"primary_module":"invalid","sort_field":"created_at"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'Invalid report module was accepted';
  v_denied := false;

  BEGIN
    PERFORM public.execute_custom_report(
      NULL,
      '{"primary_module":"accounts","sort_field":"account_type"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'Sorting by a hidden field was accepted';
  v_denied := false;

  BEGIN
    PERFORM public.execute_custom_report(
      NULL,
      '{"primary_module":"accounts","sort_field":"name; select pg_sleep(1)"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'SQL-like sort input was accepted';

  v_result := public.execute_custom_report(
    NULL,
    '{"primary_module":"activities","sort_field":"created_at"}'::jsonb
  );
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008341'
  ), 'BDO cannot see its scoped task';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008342'
  ), 'Activity report crossed the BDO branch scope';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data ? 'description' OR row_data ? 'meeting_url' OR row_data ? 'call_duration_minutes'
  ), 'Activity report returned non-allowlisted fields';
END;
$$;
RESET ROLE;

INSERT INTO public.role_permissions(role_id, permission_id, is_granted)
VALUES ('BDO', 'sales_targets.view', true)
ON CONFLICT (role_id, permission_id)
DO UPDATE SET is_granted = true;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000008312","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.execute_custom_report(
    NULL,
    '{"primary_module":"quotas","sort_field":"period_year"}'::jsonb
  );
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008351'
      AND row_data->>'period_year' = '2026'
  ), 'BDO cannot see its own quota';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008352'
  ), 'Quota report crossed the BDO branch scope';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data ? 'user_id' OR row_data ? 'created_by_id'
  ), 'Quota report returned non-allowlisted identity fields';
END;
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000008311","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.execute_custom_report(
    NULL,
    '{"primary_module":"accounts","sort_field":"created_at"}'::jsonb
  );
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008331'
  ), 'ASM cannot see its own account';
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008332'
  ), 'ASM cannot see its subordinate BDO account';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' IN (
      'c0de0000-0000-4000-8000-000000008333',
      'c0de0000-0000-4000-8000-000000008334'
    )
  ), 'ASM report crossed into a parallel branch';
END;
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000008313","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.execute_custom_report(
    NULL,
    '{"primary_module":"accounts","sort_field":"created_at"}'::jsonb
  );
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' = 'c0de0000-0000-4000-8000-000000008333'
  ), 'Parallel ASM cannot see its own account';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'rows') AS row_data
    WHERE row_data->>'id' IN (
      'c0de0000-0000-4000-8000-000000008331',
      'c0de0000-0000-4000-8000-000000008332'
    )
  ), 'Parallel ASM report saw another branch';
END;
$$;
RESET ROLE;
