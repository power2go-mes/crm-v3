-- =============================================================================
-- FINLONEXA CRM v3 — Phase 05D Functional Closure Migration
-- Automated Workflow Event Triggers, Enhanced Scheduled Reminders & Hardened Reporting
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Database Triggers for Automated Workflow Execution (Priority 1)
-- ----------------------------------------------------------------------------

-- Opportunity workflow dispatcher
CREATE OR REPLACE FUNCTION public.trg_workflow_dispatch_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN
      PERFORM public.process_crm_workflow_event(
        'opportunity_created',
        'opportunity',
        NEW.id,
        jsonb_build_object(
          'id', NEW.id,
          'name', NEW.name,
          'stage', NEW.stage,
          'amount', NEW.amount,
          'owner_id', NEW.owner_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Workflow dispatch on opportunity_created failed: %', SQLERRM;
    END;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if stage changed
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      BEGIN
        PERFORM public.process_crm_workflow_event(
          'opportunity_stage_changed',
          'opportunity',
          NEW.id,
          jsonb_build_object(
            'id', NEW.id,
            'name', NEW.name,
            'stage', NEW.stage,
            'previous_stage', OLD.stage,
            'amount', NEW.amount,
            'owner_id', NEW.owner_id
          )
        );

        IF NEW.stage = 'closed_won' THEN
          PERFORM public.process_crm_workflow_event(
            'opportunity_closed_won',
            'opportunity',
            NEW.id,
            jsonb_build_object(
              'id', NEW.id,
              'name', NEW.name,
              'stage', NEW.stage,
              'amount', NEW.amount,
              'owner_id', NEW.owner_id
            )
          );
        ELSIF NEW.stage = 'closed_lost' THEN
          PERFORM public.process_crm_workflow_event(
            'opportunity_closed_lost',
            'opportunity',
            NEW.id,
            jsonb_build_object(
              'id', NEW.id,
              'name', NEW.name,
              'stage', NEW.stage,
              'amount', NEW.amount,
              'owner_id', NEW.owner_id,
              'lost_reason', NEW.lost_reason
            )
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Workflow dispatch on opportunity stage change failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opportunities_workflow_dispatch ON public.opportunities;
CREATE TRIGGER trg_opportunities_workflow_dispatch
  AFTER INSERT OR UPDATE OF stage, amount ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_workflow_dispatch_opportunity();

-- Quote workflow dispatcher
CREATE OR REPLACE FUNCTION public.trg_workflow_dispatch_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN
      PERFORM public.process_crm_workflow_event(
        'quote_created',
        'quote',
        NEW.id,
        jsonb_build_object(
          'id', NEW.id,
          'quote_number', NEW.quote_number,
          'status', NEW.status,
          'grand_total', NEW.grand_total,
          'opportunity_id', NEW.opportunity_id,
          'owner_id', NEW.owner_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Workflow dispatch on quote_created failed: %', SQLERRM;
    END;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      BEGIN
        PERFORM public.process_crm_workflow_event(
          'quote_status_changed',
          'quote',
          NEW.id,
          jsonb_build_object(
            'id', NEW.id,
            'quote_number', NEW.quote_number,
            'status', NEW.status,
            'previous_status', OLD.status,
            'grand_total', NEW.grand_total,
            'opportunity_id', NEW.opportunity_id,
            'owner_id', NEW.owner_id
          )
        );

        IF NEW.status = 'accepted' THEN
          PERFORM public.process_crm_workflow_event(
            'quote_accepted',
            'quote',
            NEW.id,
            jsonb_build_object(
              'id', NEW.id,
              'quote_number', NEW.quote_number,
              'status', NEW.status,
              'grand_total', NEW.grand_total,
              'opportunity_id', NEW.opportunity_id,
              'owner_id', NEW.owner_id
            )
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Workflow dispatch on quote status change failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_workflow_dispatch ON public.crm_quotes;
CREATE TRIGGER trg_quotes_workflow_dispatch
  AFTER INSERT OR UPDATE OF status ON public.crm_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_workflow_dispatch_quote();

-- Activity workflow dispatcher
CREATE OR REPLACE FUNCTION public.trg_workflow_dispatch_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN
      PERFORM public.process_crm_workflow_event(
        'activity_created',
        'activity',
        NEW.id,
        jsonb_build_object(
          'id', NEW.id,
          'activity_type', NEW.activity_type,
          'subject', NEW.subject,
          'status', NEW.status,
          'priority', NEW.priority,
          'assigned_to_id', NEW.assigned_to_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Workflow dispatch on activity_created failed: %', SQLERRM;
    END;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
      BEGIN
        PERFORM public.process_crm_workflow_event(
          'activity_completed',
          'activity',
          NEW.id,
          jsonb_build_object(
            'id', NEW.id,
            'activity_type', NEW.activity_type,
            'subject', NEW.subject,
            'status', NEW.status,
            'priority', NEW.priority,
            'assigned_to_id', NEW.assigned_to_id
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Workflow dispatch on activity_completed failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activities_workflow_dispatch ON public.activities;
CREATE TRIGGER trg_activities_workflow_dispatch
  AFTER INSERT OR UPDATE OF status ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_workflow_dispatch_activity();


-- ----------------------------------------------------------------------------
-- 2. Enhanced Scheduled Reminders RPC & pg_cron Job (Priority 2)
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
  v_user RECORD;
  v_rec RECORD;
  v_created_count INT := 0;
  v_current_user_id UUID;
BEGIN
  -- If target user is null, process reminders for all users with sales roles
  FOR v_user IN
    SELECT DISTINCT u.id as user_id
    FROM auth.users u
    WHERE (p_target_user_id IS NULL OR u.id = p_target_user_id)
      AND u.deleted_at IS NULL
  LOOP
    v_current_user_id := v_user.user_id;

    -- 1. Overdue incomplete tasks
    FOR v_rec IN
      SELECT a.id, a.subject, a.due_date, a.priority
      FROM public.activities a
      WHERE a.assigned_to_id = v_current_user_id
        AND a.activity_type = 'task'
        AND a.status NOT IN ('completed', 'cancelled')
        AND a.due_date < now()
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications n
          WHERE n.user_id = v_current_user_id
            AND n.url = '/tasks/' || a.id
            AND n.created_at >= (now() - INTERVAL '24 hours')
        )
      LIMIT 10
    LOOP
      INSERT INTO public.crm_notifications (
        user_id, sender_id, title, message, url, category
      ) VALUES (
        v_current_user_id,
        NULL,
        'Overdue Task: ' || v_rec.subject,
        'Task was due ' || to_char(v_rec.due_date, 'YYYY-MM-DD HH24:MI') || '. Please review or reschedule.',
        '/tasks/' || v_rec.id,
        'task'
      );
      v_created_count := v_created_count + 1;
    END LOOP;

    -- 2. Tasks / Meetings due today
    FOR v_rec IN
      SELECT a.id, a.subject, a.due_date, a.activity_type
      FROM public.activities a
      WHERE a.assigned_to_id = v_current_user_id
        AND a.status NOT IN ('completed', 'cancelled')
        AND a.due_date >= CURRENT_DATE
        AND a.due_date < (CURRENT_DATE + INTERVAL '1 day')
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications n
          WHERE n.user_id = v_current_user_id
            AND n.url = '/' || a.activity_type || 's/' || a.id
            AND n.created_at >= (now() - INTERVAL '24 hours')
        )
      LIMIT 10
    LOOP
      INSERT INTO public.crm_notifications (
        user_id, sender_id, title, message, url, category
      ) VALUES (
        v_current_user_id,
        NULL,
        'Scheduled Today: ' || v_rec.subject,
        initcap(v_rec.activity_type) || ' commitment scheduled for today at ' || to_char(v_rec.due_date, 'HH24:MI') || '.',
        '/' || v_rec.activity_type || 's/' || v_rec.id,
        v_rec.activity_type
      );
      v_created_count := v_created_count + 1;
    END LOOP;

    -- 3. Stalled Opportunities (>14 days in active stage)
    FOR v_rec IN
      SELECT o.id, o.name, o.stage, o.stage_entered_at
      FROM public.opportunities o
      WHERE o.owner_id = v_current_user_id
        AND o.stage NOT IN ('closed_won', 'closed_lost')
        AND o.stage_entered_at <= (now() - INTERVAL '14 days')
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications n
          WHERE n.user_id = v_current_user_id
            AND n.url = '/opportunities/' || o.id
            AND n.created_at >= (now() - INTERVAL '7 days')
        )
      LIMIT 10
    LOOP
      INSERT INTO public.crm_notifications (
        user_id, sender_id, title, message, url, category
      ) VALUES (
        v_current_user_id,
        NULL,
        'Stalled Deal: ' || v_rec.name,
        'Opportunity has been in ' || v_rec.stage || ' for over 14 days without stage progression.',
        '/opportunities/' || v_rec.id,
        'deal'
      );
      v_created_count := v_created_count + 1;
    END LOOP;

    -- 4. Expiring Quotes (within 3 days)
    FOR v_rec IN
      SELECT q.id, q.quote_number, q.valid_until, q.grand_total
      FROM public.crm_quotes q
      WHERE q.owner_id = v_current_user_id
        AND q.status IN ('draft', 'sent', 'in_review')
        AND q.valid_until IS NOT NULL
        AND q.valid_until <= (CURRENT_DATE + INTERVAL '3 days')
        AND q.valid_until >= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications n
          WHERE n.user_id = v_current_user_id
            AND n.url = '/quotes/' || q.id
            AND n.created_at >= (now() - INTERVAL '3 days')
        )
      LIMIT 10
    LOOP
      INSERT INTO public.crm_notifications (
        user_id, sender_id, title, message, url, category
      ) VALUES (
        v_current_user_id,
        NULL,
        'Expiring Quote: ' || v_rec.quote_number,
        'Quotation for $' || coalesce(v_rec.grand_total::text, '0') || ' expires on ' || to_char(v_rec.valid_until, 'YYYY-MM-DD') || '.',
        '/quotes/' || v_rec.id,
        'deal'
      );
      v_created_count := v_created_count + 1;
    END LOOP;

  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reminders_created', v_created_count
  );
END;
$$;

-- Schedule pg_cron hourly job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove if already scheduled to ensure idempotent migration
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'crm-sales-reminders-hourly';
    PERFORM cron.schedule('crm-sales-reminders-hourly', '0 * * * *', 'SELECT public.generate_sales_reminders()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron scheduling warning: %', SQLERRM;
END $$;


-- ----------------------------------------------------------------------------
-- 3. Hardened Custom Report Execution RPC (Priority 3)
-- ----------------------------------------------------------------------------

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
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_group_by TEXT;
  v_query TEXT;
  v_rows JSONB;
  v_total BIGINT;
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

  -- Enforce strict whitelist of reportable modules & views
  CASE v_module
    WHEN 'accounts' THEN v_target_tbl := 'accounts_readable';
    WHEN 'contacts' THEN v_target_tbl := 'contacts_readable';
    WHEN 'opportunities' THEN v_target_tbl := 'opportunities_readable';
    WHEN 'campaigns' THEN v_target_tbl := 'campaigns_readable';
    WHEN 'activities' THEN v_target_tbl := 'activities';
    WHEN 'quotas' THEN v_target_tbl := 'crm_sales_quotas';
    ELSE RAISE EXCEPTION 'Invalid report module: %', v_module USING errcode = '42501';
  END CASE;

  -- Enforce effective module permission
  IF auth.uid() IS NOT NULL AND NOT public.has_effective_permission(auth.uid(), v_module || '.view') AND v_module <> 'quotas' THEN
    RAISE EXCEPTION 'Access denied for module %', v_module USING errcode = '42501';
  ELSIF auth.uid() IS NULL AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  -- Sanitize sort field: must strictly match alphanumeric/underscore
  v_sort_col := coalesce(v_config->>'sort_field', 'created_at');
  IF NOT (v_sort_col ~ '^[a-zA-Z0-9_]+$') THEN
    v_sort_col := 'created_at';
  END IF;

  v_sort_dir := CASE WHEN lower(v_config->>'sort_direction') = 'asc' THEN 'ASC' ELSE 'DESC' END;

  -- Sanitize group by field
  v_group_by := v_config->>'group_by_field';
  IF v_group_by IS NOT NULL AND NOT (v_group_by ~ '^[a-zA-Z0-9_]+$') THEN
    v_group_by := NULL;
  END IF;

  -- Build secure query using identifier quoting
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

GRANT EXECUTE ON FUNCTION public.trg_workflow_dispatch_opportunity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_workflow_dispatch_quote() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_workflow_dispatch_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_sales_reminders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_custom_report(UUID, JSONB) TO authenticated;

COMMIT;
