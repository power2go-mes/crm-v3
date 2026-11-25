-- ============================================================================
-- Migration: 202611240001_phase05d_role_permissions_fix.sql
-- Description: Grant Phase 05D permissions to supervisory sales roles
-- Resolves roles.id vs roles.name lookup mismatch in 202611230002
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_role_id TEXT;
  v_perm_id TEXT;
  v_roles_all TEXT[] := ARRAY['SUPER_ADMIN', 'HEAD_OF_SALES', 'RSM', 'SSM', 'ASM'];
  v_perms_all TEXT[] := ARRAY[
    'email.manage',
    'email.send',
    'email_templates.manage',
    'automation.view',
    'automation.manage',
    'reports.manage',
    'calendar.sync'
  ];
  v_r TEXT;
BEGIN
  FOREACH v_r IN ARRAY v_roles_all LOOP
    SELECT id INTO v_role_id FROM public.roles WHERE id = v_r OR name = v_r;
    IF v_role_id IS NOT NULL THEN
      FOREACH v_perm_id IN ARRAY v_perms_all LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

COMMIT;
