-- Rollback-only security and scope regression fixtures.
-- Run only against an explicitly designated disposable database, inside an outer transaction.
INSERT INTO auth.users(id, email) VALUES
  ('c0de0000-0000-4000-8000-000000008361', 'codex-reminder-user-a@example.invalid'),
  ('c0de0000-0000-4000-8000-000000008362', 'codex-reminder-user-b@example.invalid'),
  ('c0de0000-0000-4000-8000-000000008363', 'codex-reminder-user-c@example.invalid');

INSERT INTO public.user_roles(user_id, role_id) VALUES
  ('c0de0000-0000-4000-8000-000000008361', 'BDO'),
  ('c0de0000-0000-4000-8000-000000008362', 'BDO'),
  ('c0de0000-0000-4000-8000-000000008363', 'BDO');

INSERT INTO public.activities(
  id, activity_type, subject, due_date, assigned_to_id, created_by_id
) VALUES
  ('c0de0000-0000-4000-8000-000000008371', 'task', 'Reminder Fixture A', now() - INTERVAL '1 hour', 'c0de0000-0000-4000-8000-000000008361', 'c0de0000-0000-4000-8000-000000008361'),
  ('c0de0000-0000-4000-8000-000000008372', 'task', 'Reminder Fixture B', now() - INTERVAL '1 hour', 'c0de0000-0000-4000-8000-000000008362', 'c0de0000-0000-4000-8000-000000008362'),
  ('c0de0000-0000-4000-8000-000000008373', 'task', 'Reminder Fixture C', now() - INTERVAL '1 hour', 'c0de0000-0000-4000-8000-000000008363', 'c0de0000-0000-4000-8000-000000008363');

DO $$
DECLARE
  v_result JSONB;
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.generate_sales_reminders(uuid)', 'EXECUTE'),
    'Anonymous role still has reminder RPC execution';
  ASSERT has_function_privilege('authenticated', 'public.generate_sales_reminders(uuid)', 'EXECUTE'),
    'Authenticated role lost self-service reminder execution';
  ASSERT has_function_privilege('service_role', 'public.generate_sales_reminders(uuid)', 'EXECUTE'),
    'Service role lost scheduler reminder execution';
END;
$$;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000008361","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result JSONB;
  v_denied BOOLEAN := false;
BEGIN
  v_result := public.generate_sales_reminders('c0de0000-0000-4000-8000-000000008361');
  ASSERT (v_result->>'reminders_created')::integer = 1,
    'Authenticated caller did not generate its own reminder';
  ASSERT EXISTS (
    SELECT 1 FROM public.crm_notifications
    WHERE user_id = 'c0de0000-0000-4000-8000-000000008361'
      AND url = '/tasks/c0de0000-0000-4000-8000-000000008371'
  ), 'Self-service reminder was not created';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.crm_notifications
    WHERE user_id IN (
      'c0de0000-0000-4000-8000-000000008362',
      'c0de0000-0000-4000-8000-000000008363'
    )
  ), 'Self-service call created a reminder for another user';

  BEGIN
    PERFORM public.generate_sales_reminders('c0de0000-0000-4000-8000-000000008362');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'Authenticated caller targeted another user';
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$
DECLARE
  v_denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.generate_sales_reminders('c0de0000-0000-4000-8000-000000008361');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  ASSERT v_denied, 'Anonymous reminder execution was accepted';
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.generate_sales_reminders('c0de0000-0000-4000-8000-000000008362');
  ASSERT (v_result->>'reminders_created')::integer = 1,
    'Service role reminder count was ' || coalesce(v_result->>'reminders_created', 'missing');
  ASSERT EXISTS (
    SELECT 1 FROM public.crm_notifications
    WHERE user_id = 'c0de0000-0000-4000-8000-000000008362'
      AND url = '/tasks/c0de0000-0000-4000-8000-000000008372'
  ), 'Service reminder did not stay within its requested target';
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"postgres"}', true);
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.generate_sales_reminders('c0de0000-0000-4000-8000-000000008363');
  ASSERT (v_result->>'reminders_created')::integer = 1,
    'Postgres-owned scheduler could not generate a specifically targeted reminder';
  ASSERT EXISTS (
    SELECT 1 FROM public.crm_notifications
    WHERE user_id = 'c0de0000-0000-4000-8000-000000008363'
      AND url = '/tasks/c0de0000-0000-4000-8000-000000008373'
  ), 'Scheduler reminder did not stay within its requested target';
END;
$$;
