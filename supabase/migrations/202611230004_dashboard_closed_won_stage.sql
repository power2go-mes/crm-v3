-- ============================================================================
-- Migration: 202611230004_dashboard_closed_won_stage.sql
-- Description: Align dashboard_home_table_page won-opportunities stage filter
-- Accepts canonical 'closed_won' and legacy 'Closed Won'
-- Preserves SECURITY DEFINER, crm_masked_reader ownership, RLS, and field permissions
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.dashboard_home_table_page(
  widget text,
  page_number integer DEFAULT 1,
  date_from date DEFAULT NULL,
  date_to date DEFAULT NULL,
  search_query text DEFAULT '',
  sort_field text DEFAULT 'created_at',
  sort_direction text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tbl text;
  wanted text[];
  field text;
  selected text := 'id';
  columns jsonb := '[]';
  missing jsonb := '[]';
  rows jsonb;
  predicate text := '';
  search_sql text := '';
  count_rows bigint;
  order_column text;
BEGIN
  -- Strict permission check for dashboard access
  IF NOT public.has_effective_permission(auth.uid(), 'dashboard.view') THEN
    RAISE EXCEPTION 'Dashboard denied' USING errcode = '42501';
  END IF;

  -- Input validation
  IF page_number < 1 OR page_number > 10000 OR date_from > date_to OR length(search_query) > 100 OR sort_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'Invalid table request';
  END IF;

  -- Widget routing & stage predicates
  CASE widget
    WHEN 'won-leads' THEN
      tbl := 'leads';
      wanted := ARRAY['first_name', 'last_name', 'email', 'lead_source'];
      predicate := ' AND is_convert';
    WHEN 'open-leads' THEN
      tbl := 'leads';
      wanted := ARRAY['first_name', 'last_name', 'email', 'lead_source'];
      predicate := ' AND NOT is_convert';
    WHEN 'accounts' THEN
      tbl := 'accounts';
      wanted := ARRAY['name', 'account_type', 'account_source', 'annual_revenue'];
    WHEN 'contacts' THEN
      tbl := 'contacts';
      wanted := ARRAY['title', 'first_name', 'email', 'contact_source'];
    WHEN 'campaigns' THEN
      tbl := 'campaigns';
      wanted := ARRAY['campaign_name', 'campaign_type', 'status'];
    WHEN 'won-opportunities' THEN
      tbl := 'opportunities';
      wanted := ARRAY['name', 'amount', 'stage'];
      -- Match canonical 'closed_won' and legacy 'Closed Won'
      predicate := ' AND (stage = ''closed_won'' OR stage = ''Closed Won'')';
    ELSE
      RAISE EXCEPTION 'Unknown widget';
  END CASE;

  -- Module permission check
  IF NOT public.has_effective_permission(auth.uid(), tbl || '.view') THEN
    RAISE EXCEPTION 'Module denied' USING errcode = '42501';
  END IF;

  IF to_regclass('public.' || tbl) IS NULL THEN
    RETURN jsonb_build_object('columns', '[]'::jsonb, 'rows', '[]'::jsonb, 'missing', to_jsonb(wanted), 'has_more', false, 'total_count', 0);
  END IF;

  -- Verify RLS is enabled on target table
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Unscoped source';
  END IF;

  -- Build field projections and field-level permission checks
  FOREACH field IN ARRAY wanted LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = field
    ) THEN
      missing := missing || to_jsonb(field);
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.crm_field_definitions d
      WHERE d.module = tbl AND d.key = field
    ) OR EXISTS (
      SELECT 1 FROM public.crm_field_definitions d
      WHERE d.module = tbl AND d.key = field AND public.crm_shared_field_access(d.id)
    ) THEN
      selected := selected || ',' || quote_ident(field);
      columns := columns || to_jsonb(field);
      search_sql := search_sql || CASE WHEN search_sql = '' THEN '' ELSE ' OR ' END || format('%I::text ILIKE $4', field);
    END IF;
  END LOOP;

  -- Sort validation
  IF sort_field = 'created_at' OR sort_field = 'id' THEN
    order_column := sort_field;
  ELSIF columns ? sort_field THEN
    order_column := sort_field;
  ELSE
    RAISE EXCEPTION 'Sort field denied' USING errcode = '42501';
  END IF;

  -- Execute count query
  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE ($1 IS NULL OR created_at >= $1::timestamptz) AND ($2 IS NULL OR created_at < ($2 + 1)::timestamptz)%s AND ($3 = '''' OR (%s))',
    tbl, predicate, coalesce(nullif(search_sql, ''), 'false')
  )
  INTO count_rows
  USING date_from, date_to, search_query, '%' || search_query || '%';

  -- Execute paginated data query
  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) FROM (SELECT %s FROM public.%I WHERE ($1 IS NULL OR created_at >= $1::timestamptz) AND ($2 IS NULL OR created_at < ($2 + 1)::timestamptz)%s AND ($3 = '''' OR (%s)) ORDER BY %I %s, id LIMIT 10 OFFSET $5) r',
    selected, tbl, predicate, coalesce(nullif(search_sql, ''), 'false'), order_column, sort_direction
  )
  INTO rows
  USING date_from, date_to, search_query, '%' || search_query || '%', (page_number - 1) * 10;

  RETURN jsonb_build_object(
    'columns', columns,
    'rows', rows,
    'missing', missing,
    'total_count', count_rows,
    'has_more', page_number * 10 < count_rows
  );
END;
$$;

-- Ensure ownership by crm_masked_reader for RLS/security definer boundary
GRANT CREATE ON SCHEMA public TO crm_masked_reader;
ALTER FUNCTION public.dashboard_home_table_page(text, integer, date, date, text, text, text) OWNER TO crm_masked_reader;
REVOKE CREATE ON SCHEMA public FROM crm_masked_reader;

REVOKE ALL ON FUNCTION public.dashboard_home_table_page(text, integer, date, date, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_home_table_page(text, integer, date, date, text, text, text) TO authenticated, service_role;

COMMIT;
