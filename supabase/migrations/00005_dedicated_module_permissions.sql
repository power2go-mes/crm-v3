-- =============================================================================
-- Migration 00005: Dedicated Module Permissions & Dynamic SUPER_ADMIN Resolution
-- 
-- 1. Adds dedicated view permissions:
--    - dashboard.view
--    - tasks.view
--    - calls.view
--    - meetings.view
--    - reports.view
--    - sales_performance.view
-- 
-- 2. Seeds initial role permission grants for canonical roles:
--    - SUPER_ADMIN: Granted all module permissions
--    - HEAD_OF_SALES, RSM, SSM, ASM: Granted all module permissions
--    - BDO: Granted dashboard, tasks, calls, meetings, reports; 
--           leads.create remains strictly false by default.
-- 
-- 3. Updates has_effective_permission function:
--    - Removes hardcoded SUPER_ADMIN bypass so all roles (including SUPER_ADMIN)
--      resolve effective permissions dynamically from role_permissions.
-- =============================================================================

-- 1. Insert dedicated permissions catalog
insert into public.permissions (id, module, action, description)
values
    ('dashboard.view', 'dashboard', 'view', 'View executive sales overview and KPIs'),
    ('tasks.view', 'tasks', 'view', 'View tasks, reminders, and daily action items'),
    ('calls.view', 'calls', 'view', 'View call activity logs and outreach records'),
    ('meetings.view', 'meetings', 'view', 'View scheduled customer meetings and calendar'),
    ('reports.view', 'reports', 'view', 'View executive reporting dashboards and analytics'),
    ('sales_performance.view', 'sales_performance', 'view', 'View territorial and rep sales performance metrics')
on conflict (id) do update set
    module = excluded.module,
    action = excluded.action,
    description = excluded.description;

-- 2. Seed role permissions for SUPER_ADMIN
insert into public.role_permissions (role_id, permission_id, is_granted)
values
    ('SUPER_ADMIN', 'dashboard.view', true),
    ('SUPER_ADMIN', 'tasks.view', true),
    ('SUPER_ADMIN', 'calls.view', true),
    ('SUPER_ADMIN', 'meetings.view', true),
    ('SUPER_ADMIN', 'reports.view', true),
    ('SUPER_ADMIN', 'sales_performance.view', true)
on conflict (role_id, permission_id) do update set
    is_granted = excluded.is_granted;

-- 3. Seed role permissions for HEAD_OF_SALES, RSM, SSM, ASM
insert into public.role_permissions (role_id, permission_id, is_granted)
select r.id, p.id, true
from public.roles r
cross join (
    values 
        ('dashboard.view'),
        ('tasks.view'),
        ('calls.view'),
        ('meetings.view'),
        ('reports.view'),
        ('sales_performance.view')
) as p(id)
where r.id in ('HEAD_OF_SALES', 'RSM', 'SSM', 'ASM')
on conflict (role_id, permission_id) do update set
    is_granted = excluded.is_granted;

-- 4. Seed role permissions for BDO (Denies sales_performance.view by default; permits operational activities)
insert into public.role_permissions (role_id, permission_id, is_granted)
values
    ('BDO', 'dashboard.view', true),
    ('BDO', 'tasks.view', true),
    ('BDO', 'calls.view', true),
    ('BDO', 'meetings.view', true),
    ('BDO', 'reports.view', true),
    ('BDO', 'sales_performance.view', false)
on conflict (role_id, permission_id) do update set
    is_granted = excluded.is_granted;

-- 5. Redefine has_effective_permission to enforce dynamic evaluation for ALL roles
create or replace function public.has_effective_permission(p_user_id uuid, p_permission_id text)
returns boolean as $$
declare
    v_is_granted boolean;
begin
    -- Dynamic evaluation across all assigned roles
    -- Evaluates whether ANY assigned role for this user has the permission set to true
    select bool_or(rp.is_granted) into v_is_granted
    from public.user_roles ur
    inner join public.role_permissions rp on ur.role_id = rp.role_id
    where ur.user_id = p_user_id and rp.permission_id = p_permission_id;

    return coalesce(v_is_granted, false);
end;
$$ language plpgsql stable security definer;
