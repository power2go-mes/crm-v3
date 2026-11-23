-- ============================================================================
-- Migration: 202611230001_dashboard_table_page_security_definer.sql
-- Description: Align dashboard_home_table_page with Phase 05A field read security
-- Sets dashboard_home_table_page to SECURITY DEFINER owned by crm_masked_reader
-- so it can query accounts, contacts, and opportunities under RLS without 42501
-- ============================================================================

BEGIN;

GRANT CREATE ON SCHEMA public TO crm_masked_reader;

ALTER FUNCTION public.dashboard_home_table_page(text, integer, date, date, text, text, text)
SECURITY DEFINER;

ALTER FUNCTION public.dashboard_home_table_page(text, integer, date, date, text, text, text)
OWNER TO crm_masked_reader;

REVOKE CREATE ON SCHEMA public FROM crm_masked_reader;

COMMIT;
