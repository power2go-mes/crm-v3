-- FINLONEXA CRM v3 — Campaign Role Permissions
-- Maps campaign permissions to SUPER_ADMIN and canonical roles.

BEGIN;

-- 1. Grant all permissions to SUPER_ADMIN
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT 'SUPER_ADMIN', p.id, true
FROM public.permissions p
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_granted = excluded.is_granted;

-- 2. Grant campaign management to sales leadership
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id IN ('HEAD_OF_SALES', 'RSM', 'SSM', 'ASM')
  AND p.id IN ('campaigns.view', 'campaigns.create', 'campaigns.update')
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_granted = excluded.is_granted;

-- Head of Sales also has delete and export
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT 'HEAD_OF_SALES', p.id, true
FROM public.permissions p
WHERE p.id IN ('campaigns.delete', 'campaigns.export')
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_granted = excluded.is_granted;

-- BDO has view permission
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
VALUES ('BDO', 'campaigns.view', true)
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_granted = excluded.is_granted;

COMMIT;
