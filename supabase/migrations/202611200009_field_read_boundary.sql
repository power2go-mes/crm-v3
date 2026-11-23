-- =============================================================================
-- FINLONEXA CRM v3 — Migration 202611200009: Field Read Boundary & Masked Views
-- =============================================================================
-- Implements an enforceable field-aware read boundary for built-in fields.
-- 1. Creates crm_masked_reader role (NOLOGIN, INHERIT, NOBYPASSRLS).
-- 2. Revokes table-level SELECT on accounts, contacts, opportunities, campaigns
--    from public, anon, authenticated.
-- 3. Grants column-level SELECT on non-protected columns to authenticated, anon.
-- 4. Creates dynamic masking views (*_readable) owned by crm_masked_reader.
-- 5. Hardens dashboard_home_metrics and read_module_records to use crm_masked_reader.

BEGIN;

-- 1. Create role crm_masked_reader
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_masked_reader') THEN
    CREATE ROLE crm_masked_reader NOLOGIN INHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT authenticated TO crm_masked_reader;
GRANT crm_masked_reader TO postgres;
GRANT USAGE ON SCHEMA public TO crm_masked_reader;

-- 2. Function execution grants for crm_masked_reader
GRANT EXECUTE ON FUNCTION public.crm_shared_field_access(uuid, boolean) TO crm_masked_reader, authenticated;
GRANT EXECUTE ON FUNCTION public.has_effective_permission(uuid, text) TO crm_masked_reader, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_employee() TO crm_masked_reader, authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(uuid) TO crm_masked_reader, authenticated;
GRANT EXECUTE ON FUNCTION public.is_opportunity_team_member(uuid, uuid, text) TO crm_masked_reader, authenticated;

-- 3. Grant full SELECT on the four tables to crm_masked_reader
GRANT SELECT ON public.accounts, public.contacts, public.opportunities, public.campaigns TO crm_masked_reader;

-- 4. Revoke broad table SELECT from unprivileged roles
REVOKE SELECT ON public.accounts, public.contacts, public.opportunities, public.campaigns FROM public, anon, authenticated;

-- 5. Grant column-level SELECT on non-protected columns to authenticated and anon
DO $$
DECLARE
  t text;
  protected text;
  cols text;
BEGIN
  FOR t, protected IN SELECT * FROM (VALUES
    ('accounts', 'account_type'),
    ('contacts', 'contact_source'),
    ('opportunities', 'lead_source'),
    ('campaigns', 'campaign_type')
  ) v(t, p) LOOP
    SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name <> protected;

    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated, anon', cols, t);
  END LOOP;
END $$;

-- 6. Create readable views with dynamic masking
GRANT CREATE ON SCHEMA public TO crm_masked_reader;

DROP VIEW IF EXISTS public.accounts_readable CASCADE;
DROP VIEW IF EXISTS public.contacts_readable CASCADE;
DROP VIEW IF EXISTS public.opportunities_readable CASCADE;
DROP VIEW IF EXISTS public.campaigns_readable CASCADE;

-- 6a. accounts_readable
CREATE VIEW public.accounts_readable AS
SELECT
  id,
  name,
  account_owner_id,
  contact_number,
  annual_revenue,
  industry,
  no_of_employees,
  fax,
  account_source,
  website,
  billing_address,
  shipping_address,
  created_at,
  updated_at,
  CASE
    WHEN public.crm_shared_field_access((SELECT id FROM public.crm_field_definitions WHERE module = 'accounts' AND key = 'account_type' LIMIT 1))
    THEN account_type
    ELSE NULL
  END AS account_type
FROM public.accounts;

ALTER VIEW public.accounts_readable OWNER TO crm_masked_reader;
GRANT SELECT ON public.accounts_readable TO authenticated, anon;

-- 6b. contacts_readable
CREATE OR REPLACE VIEW public.contacts_readable AS
SELECT
  id,
  account_id,
  first_name,
  last_name,
  title,
  email,
  contact_number,
  secondary_contact_number,
  contact_owner_id,
  created_at,
  updated_at,
  parent_contact_id,
  is_primary,
  CASE
    WHEN public.crm_shared_field_access((SELECT id FROM public.crm_field_definitions WHERE module = 'contacts' AND key = 'contact_source' LIMIT 1))
    THEN contact_source
    ELSE NULL
  END AS contact_source
FROM public.contacts;

ALTER VIEW public.contacts_readable OWNER TO crm_masked_reader;
GRANT SELECT ON public.contacts_readable TO authenticated, anon;

-- 6c. opportunities_readable
CREATE OR REPLACE VIEW public.opportunities_readable AS
SELECT
  id,
  name,
  account_id,
  owner_id,
  stage,
  amount,
  close_date,
  probability,
  created_at,
  updated_at,
  primary_campaign_source_id,
  CASE
    WHEN public.crm_shared_field_access((SELECT id FROM public.crm_field_definitions WHERE module = 'opportunities' AND key = 'lead_source' LIMIT 1))
    THEN lead_source
    ELSE NULL
  END AS lead_source
FROM public.opportunities;

ALTER VIEW public.opportunities_readable OWNER TO crm_masked_reader;
GRANT SELECT ON public.opportunities_readable TO authenticated, anon;

-- 6d. campaigns_readable
CREATE OR REPLACE VIEW public.campaigns_readable AS
SELECT
  id,
  campaign_name,
  campaign_owner_id,
  status,
  start_date,
  end_date,
  expected_revenue,
  budget_cost,
  actual_cost,
  expected_response,
  number_sent,
  description,
  parent_campaign_id,
  leads_in_campaign,
  converted_leads_in_campaign,
  contacts_in_campaign,
  opportunities_in_campaign,
  won_opportunities_in_campaign,
  value_opportunities,
  value_won_opportunities,
  responses_in_campaign,
  created_at,
  updated_at,
  CASE
    WHEN public.crm_shared_field_access((SELECT id FROM public.crm_field_definitions WHERE module = 'campaigns' AND key = 'campaign_type' LIMIT 1))
    THEN campaign_type
    ELSE NULL
  END AS campaign_type
FROM public.campaigns;

ALTER VIEW public.campaigns_readable OWNER TO crm_masked_reader;
GRANT SELECT ON public.campaigns_readable TO authenticated, anon;

-- 7. read_module_records function owned by crm_masked_reader
CREATE OR REPLACE FUNCTION public.read_module_records(
  m text,
  rid uuid default null,
  page_number integer default 1,
  page_size integer default 20
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  rows jsonb;
  row_data jsonb;
  result jsonb := '[]'::jsonb;
  f record;
BEGIN
  IF m IS NULL OR page_number IS NULL OR page_size IS NULL 
     OR m NOT IN ('accounts', 'contacts', 'opportunities', 'campaigns')
     OR page_number < 1 OR page_number > 10000 
     OR page_size < 1 OR page_size > 100 THEN
    RAISE EXCEPTION 'Invalid read request';
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_effective_permission(auth.uid(), m || '.view') THEN
    RAISE EXCEPTION 'Read denied' USING errcode = '42501';
  END IF;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE ($1 IS NULL OR id = $1) ORDER BY id LIMIT $2 OFFSET $3) r',
    m
  ) INTO rows USING rid, page_size, (page_number - 1) * page_size;

  FOR row_data IN SELECT value FROM jsonb_array_elements(rows) LOOP
    FOR f IN SELECT id, key FROM public.crm_field_definitions WHERE module = m LOOP
      IF NOT public.crm_shared_field_access(f.id) THEN
        row_data := row_data - f.key;
      END IF;
    END LOOP;
    result := result || jsonb_build_array(row_data);
  END LOOP;

  RETURN result;
END;
$$;

ALTER FUNCTION public.read_module_records(text, uuid, integer, integer) OWNER TO crm_masked_reader;
REVOKE ALL ON FUNCTION public.read_module_records(text, uuid, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.read_module_records(text, uuid, integer, integer) TO authenticated;

-- 8. dashboard_home_metrics function owned by crm_masked_reader
CREATE OR REPLACE FUNCTION public.dashboard_home_metrics(date_from date default null, date_to date default null)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  item record;
  stats jsonb := '[]'::jsonb;
  charts jsonb := '[]'::jsonb;
  groups jsonb;
  n bigint;
  clause text;
BEGIN
  IF NOT public.has_effective_permission(auth.uid(), 'dashboard.view') THEN
    RAISE EXCEPTION 'Dashboard denied' USING errcode = '42501';
  END IF;

  IF date_from > date_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  FOR item IN SELECT * FROM (VALUES
    ('accounts', 'Total Accounts'),
    ('campaigns', 'Total Campaigns'),
    ('contacts', 'Total Contacts'),
    ('leads', 'Total Leads'),
    ('opportunities', 'Total Opportunities')
  ) v(tbl, label) LOOP
    IF public.has_effective_permission(auth.uid(), item.tbl || '.view') AND to_regclass('public.' || item.tbl) IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = 'public' AND c.relname = item.tbl AND c.relrowsecurity
      ) THEN
        RAISE EXCEPTION 'Unscoped metric source';
      END IF;

      clause := CASE WHEN item.tbl = 'leads' THEN ' AND NOT is_convert' ELSE '' END;
      EXECUTE format(
        'SELECT count(id) FROM public.%I WHERE ($1 IS NULL OR created_at >= $1::timestamptz) AND ($2 IS NULL OR created_at < ($2+1)::timestamptz)' || clause,
        item.tbl
      ) INTO n USING date_from, date_to;

      stats := stats || jsonb_build_array(jsonb_build_object('title', item.label, 'value', n));
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM (VALUES
    ('leads', 'lead_source', 'Leads by Source', 'funnel'),
    ('leads', 'status', 'Leads by Stage', 'bar'),
    ('accounts', 'account_type', 'Accounts by Account Type', 'pie'),
    ('campaigns', 'campaign_type', 'Campaigns by Type', 'donut'),
    ('opportunities', 'lead_source', 'Opportunities by Lead Source', 'bar')
  ) v(tbl, col, title, kind) LOOP
    IF public.has_effective_permission(auth.uid(), item.tbl || '.view') THEN
      IF EXISTS (SELECT 1 FROM public.crm_field_definitions d WHERE d.module = item.tbl AND d.key = item.col)
         AND NOT EXISTS (
           SELECT 1 FROM public.crm_field_definitions d
           WHERE d.module = item.tbl AND d.key = item.col AND public.crm_shared_field_access(d.id)
         ) THEN
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = item.tbl AND column_name = item.col
      ) THEN
        charts := charts || jsonb_build_array(jsonb_build_object('id', item.tbl || '.' || item.col, 'title', item.title, 'kind', item.kind, 'status', 'schema_missing', 'data', '[]'::jsonb));
      ELSE
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace ns ON ns.oid = c.relnamespace
          WHERE ns.nspname = 'public' AND c.relname = item.tbl AND c.relrowsecurity
        ) THEN
          RAISE EXCEPTION 'Unscoped chart source';
        END IF;

        IF item.tbl = 'leads' AND item.col = 'status' THEN
          SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) INTO groups FROM (
            SELECT coalesce(s.name, 'No stage') label, count(l.id) value
            FROM public.leads l
            LEFT JOIN public.lead_statuses s ON s.id = l.status
            WHERE NOT l.is_convert
              AND (date_from IS NULL OR l.created_at >= date_from::timestamptz)
              AND (date_to IS NULL OR l.created_at < (date_to + 1)::timestamptz)
            GROUP BY l.status, s.name
            ORDER BY value DESC, label
            LIMIT 200
          ) g;
        ELSE
          clause := CASE WHEN item.tbl = 'leads' THEN ' AND NOT is_convert' ELSE '' END;
          EXECUTE format(
            'SELECT coalesce(jsonb_agg(to_jsonb(g)), ''[]''::jsonb) FROM (SELECT coalesce(nullif(%I::text, ''''), ''Unknown'') label, count(id) value FROM public.%I WHERE ($1 IS NULL OR created_at >= $1::timestamptz) AND ($2 IS NULL OR created_at < ($2+1)::timestamptz)' || clause || ' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 200) g',
            item.col, item.tbl
          ) INTO groups USING date_from, date_to;
        END IF;

        charts := charts || jsonb_build_array(jsonb_build_object('id', item.tbl || '.' || item.col, 'title', item.title, 'kind', item.kind, 'status', 'ready', 'data', groups));
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('kpis', stats, 'charts', charts);
END;
$$;

ALTER FUNCTION public.dashboard_home_metrics(date, date) OWNER TO crm_masked_reader;
REVOKE ALL ON FUNCTION public.dashboard_home_metrics(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_home_metrics(date, date) TO authenticated;

REVOKE CREATE ON SCHEMA public FROM crm_masked_reader;

NOTIFY pgrst, 'reload schema';

COMMIT;
