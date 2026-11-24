-- ============================================================================
-- Migration: 20261124000100_super_admin_universal_permissions.sql
-- Description: Grant all missing active system permissions to SUPER_ADMIN
--              Ensures SUPER_ADMIN has full administrative authority across all pages
-- ============================================================================

BEGIN;

INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT 'SUPER_ADMIN', p.id, true
FROM public.permissions p
ON CONFLICT (role_id, permission_id) 
DO UPDATE SET is_granted = true;

COMMIT;
