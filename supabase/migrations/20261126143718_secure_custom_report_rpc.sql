BEGIN;

CREATE OR REPLACE FUNCTION public.execute_custom_report(
  p_report_id UUID DEFAULT NULL,
  p_config JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_config JSONB;
  v_user_id UUID := auth.uid();
  v_module TEXT;
  v_source TEXT;
  v_select_list TEXT := '*';
  v_scope_clause TEXT := '$1 IS NOT NULL';
  v_allowed_sort_fields TEXT[];
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_sort_allowed BOOLEAN;
  v_field_id UUID;
  v_total BIGINT;
  v_rows JSONB;
  v_query TEXT;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_active_employee() THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF NOT public.has_effective_permission(v_user_id, 'reports.view') THEN
    RAISE EXCEPTION 'Report access denied' USING errcode = '42501';
  END IF;

  IF p_report_id IS NOT NULL THEN
    SELECT to_jsonb(r) INTO v_config
    FROM public.crm_custom_reports AS r
    WHERE r.id = p_report_id;
  ELSE
    v_config := p_config;
  END IF;

  IF v_config IS NULL OR jsonb_typeof(v_config) <> 'object' THEN
    RAISE EXCEPTION 'Report configuration is required' USING errcode = '22023';
  END IF;

  v_module := v_config->>'primary_module';

  CASE v_module
    WHEN 'accounts' THEN
      IF NOT public.has_effective_permission(v_user_id, 'accounts.view') THEN
        RAISE EXCEPTION 'Report access denied' USING errcode = '42501';
      END IF;
      v_source := 'public.accounts_readable';
    WHEN 'contacts' THEN
      IF NOT public.has_effective_permission(v_user_id, 'contacts.view') THEN
        RAISE EXCEPTION 'Report access denied' USING errcode = '42501';
      END IF;
      v_source := 'public.contacts_readable';
    WHEN 'opportunities' THEN
      IF NOT public.has_effective_permission(v_user_id, 'opportunities.view') THEN
        RAISE EXCEPTION 'Report access denied' USING errcode = '42501';
      END IF;
      v_source := 'public.opportunities_readable';
    WHEN 'campaigns' THEN
      IF NOT public.has_effective_permission(v_user_id, 'campaigns.view') THEN
        RAISE EXCEPTION 'Report access denied' USING errcode = '42501';
      END IF;
      v_source := 'public.campaigns_readable';
    WHEN 'activities' THEN
      IF NOT (
        public.has_effective_permission(v_user_id, 'tasks.view')
        OR public.has_effective_permission(v_user_id, 'calls.view')
        OR public.has_effective_permission(v_user_id, 'meetings.view')
      ) THEN
        RAISE EXCEPTION 'Report access denied' USING errcode = '42501';
      END IF;
      v_source := 'public.activities';
      v_select_list := 'id, subject, activity_type, status, priority, due_date, related_to_type, created_at';
      v_allowed_sort_fields := ARRAY[
        'id', 'subject', 'activity_type', 'status', 'priority',
        'due_date', 'related_to_type', 'created_at'
      ];
    WHEN 'quotas' THEN
      IF NOT public.has_effective_permission(v_user_id, 'sales_targets.view') THEN
        RAISE EXCEPTION 'Report access denied' USING errcode = '42501';
      END IF;
      v_source := 'public.crm_sales_quotas';
      v_select_list := 'id, period_type, extract(year FROM period_start)::integer AS period_year, extract(month FROM period_start)::integer AS period_month, extract(quarter FROM period_start)::integer AS period_quarter, target_amount, currency, created_at';
      v_allowed_sort_fields := ARRAY[
        'id', 'period_type', 'period_year', 'period_month',
        'period_quarter', 'target_amount', 'currency', 'created_at'
      ];
      v_scope_clause := v_scope_clause
        || ' AND user_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids($1))';
    ELSE
      RAISE EXCEPTION 'Invalid report module' USING errcode = '42501';
  END CASE;

  v_sort_col := coalesce(v_config->>'sort_field', 'created_at');
  IF v_sort_col !~ '^[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid report sort field' USING errcode = '42501';
  END IF;

  IF v_allowed_sort_fields IS NOT NULL THEN
    v_sort_allowed := v_sort_col = ANY(v_allowed_sort_fields);
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      WHERE a.attrelid = pg_catalog.to_regclass(v_source)
        AND a.attname = v_sort_col
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) INTO v_sort_allowed;
  END IF;

  IF NOT coalesce(v_sort_allowed, false) THEN
    RAISE EXCEPTION 'Invalid report sort field' USING errcode = '42501';
  END IF;

  SELECT d.id INTO v_field_id
  FROM public.crm_field_definitions AS d
  WHERE d.module = v_module
    AND d.key = v_sort_col
    AND NOT d.archived;

  IF v_field_id IS NOT NULL AND NOT public.crm_shared_field_access(v_field_id) THEN
    RAISE EXCEPTION 'Report field access denied' USING errcode = '42501';
  END IF;

  v_sort_dir := CASE lower(coalesce(v_config->>'sort_direction', 'desc'))
    WHEN 'asc' THEN 'ASC'
    WHEN 'desc' THEN 'DESC'
    ELSE NULL
  END;

  IF v_sort_dir IS NULL THEN
    RAISE EXCEPTION 'Invalid report sort direction' USING errcode = '22023';
  END IF;

  EXECUTE pg_catalog.format(
    'SELECT count(*) FROM %s WHERE %s',
    v_source,
    v_scope_clause
  )
  INTO v_total
  USING v_user_id;

  v_query := pg_catalog.format(
    'SELECT coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) '
    || 'FROM (SELECT %s FROM %s WHERE %s ORDER BY %I %s NULLS LAST LIMIT 250) AS r',
    v_select_list,
    v_source,
    v_scope_clause,
    v_sort_col,
    v_sort_dir
  );

  EXECUTE v_query INTO v_rows USING v_user_id;

  RETURN jsonb_build_object(
    'module', v_module,
    'total_count', v_total,
    'rows', v_rows,
    'limit', 250
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_custom_report(UUID, JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.execute_custom_report(UUID, JSONB)
  TO authenticated;

COMMIT;
