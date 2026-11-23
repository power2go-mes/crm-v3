-- ============================================================================
-- Migration: 202611230002_phase05d_productivity_automation.sql
-- Description: Phase 05D - Email Communication, Workflow Automation,
--              Automated Sales Reminders, Custom Report Builder & Calendar Sync
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Permissions & Role Mapping
-- ----------------------------------------------------------------------------
INSERT INTO public.permissions (id, module, action, description)
VALUES
  ('email.manage', 'email', 'manage', 'Connect email accounts and configure email settings'),
  ('email.send', 'email', 'send', 'Compose and send emails from CRM records'),
  ('email_templates.manage', 'email_templates', 'manage', 'Create and manage email templates'),
  ('automation.view', 'automation', 'view', 'View workflow automation rules and execution logs'),
  ('automation.manage', 'automation', 'manage', 'Create, configure, and toggle workflow automation rules'),
  ('reports.manage', 'reports', 'manage', 'Create, edit, duplicate, and delete custom reports'),
  ('calendar.sync', 'calendar', 'sync', 'Configure calendar provider synchronization')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to roles
DO $$
DECLARE
  v_role_id UUID;
  v_perm_id TEXT;
  v_roles_all TEXT[] := ARRAY['SUPER_ADMIN', 'HEAD_OF_SALES', 'RSM', 'SSM', 'ASM'];
  v_r TEXT;
BEGIN
  -- Admin & Management roles get all Phase 05D permissions
  FOREACH v_r IN ARRAY v_roles_all LOOP
    SELECT id INTO v_role_id FROM public.roles WHERE name = v_r;
    IF v_role_id IS NOT NULL THEN
      FOREACH v_perm_id IN ARRAY ARRAY['email.manage', 'email.send', 'email_templates.manage', 'automation.view', 'automation.manage', 'reports.manage', 'calendar.sync'] LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  -- BDO role gets email sending, own email management, and calendar sync
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'BDO';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_id IN ARRAY ARRAY['email.manage', 'email.send', 'calendar.sync'] LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Workstream A: Email Accounts, Templates & Communication History
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crm_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'smtp')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  auth_status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (auth_status IN ('connected', 'disconnected', 'expired', 'error', 'unconfigured')),
  status_message TEXT,
  encrypted_tokens JSONB, -- server-only, omitted from views
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_address)
);

CREATE TABLE IF NOT EXISTS public.crm_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'sales_pitch', 'follow_up', 'quotation', 'meeting', 'renewal')),
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_to_type TEXT NOT NULL CHECK (related_to_type IN ('account', 'contact', 'opportunity', 'lead')),
  related_to_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  template_id UUID REFERENCES public.crm_email_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sent', 'provider_accepted', 'delivered', 'failed', 'received')),
  error_message TEXT,
  provider TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for Email Accounts
ALTER TABLE public.crm_email_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_email_accounts_owner_policy" ON public.crm_email_accounts;
CREATE POLICY "crm_email_accounts_owner_policy" ON public.crm_email_accounts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS for Email Templates
ALTER TABLE public.crm_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_email_templates_read_policy" ON public.crm_email_templates;
CREATE POLICY "crm_email_templates_read_policy" ON public.crm_email_templates
  FOR SELECT TO authenticated
  USING (is_shared = true OR created_by_id = auth.uid());

DROP POLICY IF EXISTS "crm_email_templates_write_policy" ON public.crm_email_templates;
CREATE POLICY "crm_email_templates_write_policy" ON public.crm_email_templates
  FOR ALL TO authenticated
  USING (
    created_by_id = auth.uid() OR 
    public.has_effective_permission(auth.uid(), 'email_templates.manage')
  )
  WITH CHECK (
    created_by_id = auth.uid() OR 
    public.has_effective_permission(auth.uid(), 'email_templates.manage')
  );

-- RLS for Email History
ALTER TABLE public.crm_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_emails_access_policy" ON public.crm_emails;
CREATE POLICY "crm_emails_access_policy" ON public.crm_emails
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_effective_permission(auth.uid(), 'email.manage')
  )
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Workstream B: Sales Workflow Automation Engine
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crm_workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'opportunity_created',
    'opportunity_stage_changed',
    'opportunity_closed_won',
    'opportunity_closed_lost',
    'task_overdue',
    'meeting_scheduled',
    'quotation_status_changed',
    'record_assigned'
  )),
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.crm_workflow_rules(id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  record_type TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  actions_executed JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_workflow_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_workflow_rules_policy" ON public.crm_workflow_rules;
CREATE POLICY "crm_workflow_rules_policy" ON public.crm_workflow_rules
  FOR ALL TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'automation.view'))
  WITH CHECK (public.has_effective_permission(auth.uid(), 'automation.manage'));

DROP POLICY IF EXISTS "crm_workflow_logs_policy" ON public.crm_workflow_logs;
CREATE POLICY "crm_workflow_logs_policy" ON public.crm_workflow_logs
  FOR SELECT TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'automation.view'));

-- Workflow execution engine RPC with idempotency and loop prevention
CREATE OR REPLACE FUNCTION public.process_crm_workflow_event(
  p_trigger_event TEXT,
  p_record_type TEXT,
  p_record_id UUID,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rule RECORD;
  v_cond JSONB;
  v_action JSONB;
  v_matched BOOLEAN;
  v_executed_actions JSONB := '[]'::jsonb;
  v_total_processed INT := 0;
  v_cond_field TEXT;
  v_cond_op TEXT;
  v_cond_val TEXT;
  v_actual_val TEXT;
  v_action_type TEXT;
  v_task_title TEXT;
  v_task_desc TEXT;
  v_assignee_id UUID;
  v_target_user_id UUID;
BEGIN
  -- Prevent infinite cascades: bail if this record has already processed 10 actions in last 10 seconds
  IF (
    SELECT count(*) 
    FROM public.crm_workflow_logs 
    WHERE record_id = p_record_id 
      AND executed_at > (now() - INTERVAL '10 seconds')
  ) >= 10 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Loop prevention threshold reached');
  END IF;

  FOR v_rule IN
    SELECT * FROM public.crm_workflow_rules
    WHERE is_active = true AND trigger_event = p_trigger_event
    ORDER BY priority ASC, created_at ASC
  LOOP
    v_matched := true;
    -- Evaluate conditions
    FOR v_cond IN SELECT * FROM jsonb_array_elements(v_rule.conditions) LOOP
      v_cond_field := v_cond->>'field';
      v_cond_op := v_cond->>'operator';
      v_cond_val := v_cond->>'value';
      v_actual_val := p_event_data->>v_cond_field;

      IF v_cond_op = 'equals' AND coalesce(v_actual_val, '') <> coalesce(v_cond_val, '') THEN
        v_matched := false;
        EXIT;
      ELSIF v_cond_op = 'not_equals' AND coalesce(v_actual_val, '') = coalesce(v_cond_val, '') THEN
        v_matched := false;
        EXIT;
      ELSIF v_cond_op = 'greater_than' AND (coalesce(v_actual_val, '0')::numeric <= coalesce(v_cond_val, '0')::numeric) THEN
        v_matched := false;
        EXIT;
      END IF;
    END LOOP;

    IF v_matched THEN
      -- Execute configured actions
      FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions) LOOP
        v_action_type := v_action->>'type';

        IF v_action_type = 'create_task' THEN
          v_task_title := coalesce(v_action->>'title', 'Automated Task: ' || p_trigger_event);
          v_task_desc := coalesce(v_action->>'description', 'Generated by workflow: ' || v_rule.name);
          v_assignee_id := coalesce((v_action->>'assignee_id')::uuid, auth.uid());

          INSERT INTO public.activities (
            activity_type,
            subject,
            description,
            status,
            priority,
            due_date,
            related_to_type,
            related_to_id,
            assigned_to_id,
            created_by_id
          ) VALUES (
            'task',
            v_task_title,
            v_task_desc,
            'not_started',
            coalesce(v_action->>'priority', 'medium'),
            now() + INTERVAL '2 days',
            p_record_type,
            p_record_id,
            v_assignee_id,
            coalesce(auth.uid(), v_assignee_id)
          );

          v_executed_actions := v_executed_actions || jsonb_build_object('type', 'create_task', 'title', v_task_title);

        ELSIF v_action_type = 'create_notification' THEN
          v_target_user_id := coalesce((v_action->>'user_id')::uuid, (p_event_data->>'owner_id')::uuid, auth.uid());

          IF v_target_user_id IS NOT NULL THEN
            INSERT INTO public.crm_notifications (
              user_id,
              sender_id,
              title,
              message,
              url,
              category
            ) VALUES (
              v_target_user_id,
              auth.uid(),
              coalesce(v_action->>'title', 'Workflow Alert: ' || v_rule.name),
              coalesce(v_action->>'message', 'Triggered on ' || p_record_type),
              '/' || p_record_type || 's/' || p_record_id,
              coalesce(v_action->>'category', 'system')
            );

            v_executed_actions := v_executed_actions || jsonb_build_object('type', 'create_notification', 'target', v_target_user_id);
          END IF;
        END IF;
      END LOOP;

      INSERT INTO public.crm_workflow_logs (
        rule_id,
        record_id,
        record_type,
        trigger_event,
        status,
        actions_executed
      ) VALUES (
        v_rule.id,
        p_record_id,
        p_record_type,
        p_trigger_event,
        'success',
        v_executed_actions
      );

      v_total_processed := v_total_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rules_matched', v_total_processed,
    'actions_executed', v_executed_actions
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Workstream C: Automated Sales Reminders RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_sales_reminders(
  p_target_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := coalesce(p_target_user_id, auth.uid());
  v_rec RECORD;
  v_created_count INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user specified');
  END IF;

  -- 1. Tasks due today or overdue
  FOR v_rec IN
    SELECT a.id, a.subject, a.due_date, a.related_to_type, a.related_to_id
    FROM public.activities a
    WHERE a.assigned_to_id = v_user_id
      AND a.activity_type = 'task'
      AND a.status NOT IN ('completed', 'cancelled')
      AND a.due_date <= now() + INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_notifications n
        WHERE n.user_id = v_user_id
          AND n.url = '/tasks/' || a.id
          AND n.created_at >= (now() - INTERVAL '24 hours')
      )
    LIMIT 10
  LOOP
    INSERT INTO public.crm_notifications (
      user_id, sender_id, title, message, url, category
    ) VALUES (
      v_user_id,
      NULL,
      'Task Reminder: ' || v_rec.subject,
      'Task is due on ' || to_char(v_rec.due_date, 'YYYY-MM-DD HH24:MI'),
      '/tasks/' || v_rec.id,
      'task'
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  -- 2. Stalled Opportunities (>14 days in active stage)
  FOR v_rec IN
    SELECT o.id, o.name, o.stage, o.stage_entered_at
    FROM public.opportunities o
    WHERE o.owner_id = v_user_id
      AND o.stage NOT IN ('closed_won', 'closed_lost')
      AND o.stage_entered_at <= (now() - INTERVAL '14 days')
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_notifications n
        WHERE n.user_id = v_user_id
          AND n.url = '/opportunities/' || o.id
          AND n.created_at >= (now() - INTERVAL '7 days')
      )
    LIMIT 10
  LOOP
    INSERT INTO public.crm_notifications (
      user_id, sender_id, title, message, url, category
    ) VALUES (
      v_user_id,
      NULL,
      'Stalled Deal: ' || v_rec.name,
      'Opportunity has been in ' || v_rec.stage || ' for over 14 days without stage progression.',
      '/opportunities/' || v_rec.id,
      'deal'
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'reminders_created', v_created_count
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Workstream D: Custom Report Builder
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crm_custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  primary_module TEXT NOT NULL CHECK (primary_module IN ('accounts', 'contacts', 'opportunities', 'campaigns', 'activities', 'quotas')),
  selected_columns TEXT[] NOT NULL DEFAULT '{}',
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_field TEXT DEFAULT 'created_at',
  sort_direction TEXT DEFAULT 'desc' CHECK (sort_direction IN ('asc', 'desc')),
  group_by_field TEXT,
  aggregations JSONB DEFAULT '[]'::jsonb,
  chart_type TEXT DEFAULT 'table' CHECK (chart_type IN ('table', 'bar', 'pie', 'line', 'donut')),
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_custom_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_custom_reports_read_policy" ON public.crm_custom_reports;
CREATE POLICY "crm_custom_reports_read_policy" ON public.crm_custom_reports
  FOR SELECT TO authenticated
  USING (
    is_shared = true OR 
    created_by_id = auth.uid() OR
    public.has_effective_permission(auth.uid(), 'reports.manage')
  );

DROP POLICY IF EXISTS "crm_custom_reports_write_policy" ON public.crm_custom_reports;
CREATE POLICY "crm_custom_reports_write_policy" ON public.crm_custom_reports
  FOR ALL TO authenticated
  USING (
    created_by_id = auth.uid() OR
    public.has_effective_permission(auth.uid(), 'reports.manage')
  )
  WITH CHECK (
    created_by_id = auth.uid() OR
    public.has_effective_permission(auth.uid(), 'reports.manage')
  );

-- Report execution RPC using server-controlled whitelisting and readable views
CREATE OR REPLACE FUNCTION public.execute_custom_report(
  p_report_id UUID DEFAULT NULL,
  p_config JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_config JSONB;
  v_module TEXT;
  v_target_tbl TEXT;
  v_cols TEXT[];
  v_col_str TEXT := '';
  v_col TEXT;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_query TEXT;
  v_rows JSONB;
  v_total BIGINT;
  v_group_by TEXT;
BEGIN
  IF p_report_id IS NOT NULL THEN
    SELECT to_jsonb(r) INTO v_config
    FROM public.crm_custom_reports r
    WHERE r.id = p_report_id;
  ELSE
    v_config := p_config;
  END IF;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Report configuration is required' USING errcode = '42000';
  END IF;

  v_module := v_config->>'primary_module';
  
  -- Whitelist source readable view
  CASE v_module
    WHEN 'accounts' THEN v_target_tbl := 'accounts_readable';
    WHEN 'contacts' THEN v_target_tbl := 'contacts_readable';
    WHEN 'opportunities' THEN v_target_tbl := 'opportunities_readable';
    WHEN 'campaigns' THEN v_target_tbl := 'campaigns_readable';
    WHEN 'activities' THEN v_target_tbl := 'activities';
    WHEN 'quotas' THEN v_target_tbl := 'crm_sales_quotas';
    ELSE RAISE EXCEPTION 'Invalid report module: %', v_module USING errcode = '42501';
  END CASE;

  -- Permission check
  IF auth.uid() IS NOT NULL AND NOT public.has_effective_permission(auth.uid(), v_module || '.view') AND v_module <> 'quotas' THEN
    RAISE EXCEPTION 'Access denied for module %', v_module USING errcode = '42501';
  ELSIF auth.uid() IS NULL AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  v_sort_col := coalesce(v_config->>'sort_field', 'created_at');
  v_sort_dir := CASE WHEN lower(v_config->>'sort_direction') = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_group_by := v_config->>'group_by_field';

  -- Build safe SELECT statement
  v_query := format('
    SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
    FROM (
      SELECT *
      FROM public.%I
      ORDER BY %I %s NULLS LAST
      LIMIT 250
    ) t',
    v_target_tbl, v_sort_col, v_sort_dir
  );

  EXECUTE v_query INTO v_rows;
  EXECUTE format('SELECT count(*) FROM public.%I', v_target_tbl) INTO v_total;

  RETURN jsonb_build_object(
    'module', v_module,
    'total_count', v_total,
    'rows', v_rows,
    'limit', 250
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Workstream E: Google & Microsoft Calendar Integration Foundation
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crm_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'microsoft_outlook')),
  calendar_id TEXT,
  calendar_name TEXT,
  sync_status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (sync_status IN ('unconfigured', 'connected', 'syncing', 'error', 'disabled')),
  sync_direction TEXT NOT NULL DEFAULT 'both' CHECK (sync_direction IN ('both', 'crm_to_external', 'external_to_crm')),
  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.crm_calendar_sync_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.crm_calendar_connections(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  last_sync_hash TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, activity_id)
);

ALTER TABLE public.crm_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calendar_sync_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_calendar_connections_owner_policy" ON public.crm_calendar_connections;
CREATE POLICY "crm_calendar_connections_owner_policy" ON public.crm_calendar_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "crm_calendar_sync_links_policy" ON public.crm_calendar_sync_links;
CREATE POLICY "crm_calendar_sync_links_policy" ON public.crm_calendar_sync_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_calendar_connections c
      WHERE c.id = crm_calendar_sync_links.connection_id
        AND c.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Grant Execution & Function Permissions
-- ----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.process_crm_workflow_event(TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_sales_reminders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_custom_report(UUID, JSONB) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_email_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_emails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_workflow_rules TO authenticated;
GRANT SELECT ON public.crm_workflow_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_custom_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_calendar_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_calendar_sync_links TO authenticated;

COMMIT;
