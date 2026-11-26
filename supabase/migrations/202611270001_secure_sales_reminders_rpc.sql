BEGIN;

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
  v_actor_user_id UUID;
  v_effective_target_user_id UUID;
  v_can_view_tasks BOOLEAN;
  v_can_view_calls BOOLEAN;
  v_can_view_meetings BOOLEAN;
  v_can_view_opportunities BOOLEAN;
  v_can_view_quotes BOOLEAN;
BEGIN
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NOT NULL THEN
    IF NOT public.is_active_employee() THEN
      RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
    END IF;

    IF p_target_user_id IS NOT NULL AND p_target_user_id <> v_actor_user_id THEN
      RAISE EXCEPTION 'Reminder target is outside the caller scope' USING errcode = '42501';
    END IF;

    v_effective_target_user_id := v_actor_user_id;
  ELSE
    IF coalesce(auth.role(), '') <> 'service_role' AND session_user <> 'postgres' THEN
      RAISE EXCEPTION 'Trusted scheduler access required' USING errcode = '42501';
    END IF;

    v_effective_target_user_id := p_target_user_id;
  END IF;

  FOR v_user IN
    SELECT DISTINCT u.id AS user_id
    FROM auth.users AS u
    JOIN public.user_profiles AS profile
      ON profile.id = u.id
      AND profile.is_active
    WHERE (v_effective_target_user_id IS NULL OR u.id = v_effective_target_user_id)
      AND u.deleted_at IS NULL
  LOOP
    v_current_user_id := v_user.user_id;
    IF v_actor_user_id IS NOT NULL THEN
      v_can_view_tasks := public.has_effective_permission(v_current_user_id, 'tasks.view');
      v_can_view_calls := public.has_effective_permission(v_current_user_id, 'calls.view');
      v_can_view_meetings := public.has_effective_permission(v_current_user_id, 'meetings.view');
      v_can_view_opportunities := public.has_effective_permission(v_current_user_id, 'opportunities.view');
      v_can_view_quotes := public.has_effective_permission(v_current_user_id, 'quotes.view');
    ELSE
      SELECT
        coalesce(bool_or(rp.is_granted) FILTER (WHERE rp.permission_id = 'tasks.view'), false),
        coalesce(bool_or(rp.is_granted) FILTER (WHERE rp.permission_id = 'calls.view'), false),
        coalesce(bool_or(rp.is_granted) FILTER (WHERE rp.permission_id = 'meetings.view'), false),
        coalesce(bool_or(rp.is_granted) FILTER (WHERE rp.permission_id = 'opportunities.view'), false),
        coalesce(bool_or(rp.is_granted) FILTER (WHERE rp.permission_id = 'quotes.view'), false)
      INTO
        v_can_view_tasks,
        v_can_view_calls,
        v_can_view_meetings,
        v_can_view_opportunities,
        v_can_view_quotes
      FROM public.user_roles AS ur
      JOIN public.roles AS r
        ON r.id = ur.role_id
        AND r.is_active
      JOIN public.role_permissions AS rp
        ON rp.role_id = ur.role_id
      WHERE ur.user_id = v_current_user_id;
    END IF;

    FOR v_rec IN
      SELECT a.id, a.subject, a.due_date, a.priority
      FROM public.activities AS a
      WHERE a.assigned_to_id = v_current_user_id
        AND a.activity_type = 'task'
        AND a.status NOT IN ('completed', 'cancelled')
        AND a.due_date < now()
        AND v_can_view_tasks
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications AS n
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

    FOR v_rec IN
      SELECT a.id, a.subject, a.due_date, a.activity_type
      FROM public.activities AS a
      WHERE a.assigned_to_id = v_current_user_id
        AND a.status NOT IN ('completed', 'cancelled')
        AND (
          (a.activity_type = 'task' AND v_can_view_tasks)
          OR (a.activity_type = 'log_call' AND v_can_view_calls)
          OR (a.activity_type IN ('meeting', 'event') AND v_can_view_meetings)
        )
        AND a.due_date >= CURRENT_DATE
        AND a.due_date < (CURRENT_DATE + INTERVAL '1 day')
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications AS n
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

    FOR v_rec IN
      SELECT o.id, o.name, o.stage, o.stage_entered_at
      FROM public.opportunities AS o
      WHERE o.owner_id = v_current_user_id
        AND o.stage NOT IN ('closed_won', 'closed_lost')
        AND o.stage_entered_at <= (now() - INTERVAL '14 days')
        AND v_can_view_opportunities
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications AS n
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

    FOR v_rec IN
      SELECT q.id, q.quote_number, q.valid_until, q.grand_total
      FROM public.crm_quotes AS q
      WHERE q.owner_id = v_current_user_id
        AND q.status IN ('draft', 'sent', 'in_review')
        AND q.valid_until IS NOT NULL
        AND v_can_view_quotes
        AND q.valid_until <= (CURRENT_DATE + INTERVAL '3 days')
        AND q.valid_until >= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM public.crm_notifications AS n
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

REVOKE ALL ON FUNCTION public.generate_sales_reminders(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_sales_reminders(UUID)
  TO authenticated, service_role;

COMMIT;
