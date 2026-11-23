-- =============================================================================
-- FINLONEXA CRM v3 — Phase 1 Migration 00004: Row-Level Security (RLS) Policies
-- =============================================================================

-- Enable Row-Level Security across all security-sensitive tables
alter table public.company_settings enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.sales_regions enable row level security;
alter table public.sales_teams enable row level security;
alter table public.sales_reporting_relationships enable row level security;

-- Helper function: Check if current request is from an active employee
create or replace function public.is_active_employee()
returns boolean as $$
begin
    return exists (
        select 1 from public.user_profiles
        where id = auth.uid() and is_active = true
    );
end;
$$ language plpgsql stable security definer;

-- -----------------------------------------------------------------------------
-- 1. Company Settings Policies
-- -----------------------------------------------------------------------------
create policy "Active employees can view company settings"
on public.company_settings for select
using (public.is_active_employee());

create policy "Settings update requires settings.update permission"
on public.company_settings for update
using (public.has_effective_permission(auth.uid(), 'settings.update'))
with check (public.has_effective_permission(auth.uid(), 'settings.update'));

-- -----------------------------------------------------------------------------
-- 2. User Profiles Policies
-- -----------------------------------------------------------------------------
create policy "Active employees can view all employee profiles"
on public.user_profiles for select
using (public.is_active_employee());

create policy "Users can update their own personal profile"
on public.user_profiles for update
using (auth.uid() = id and public.is_active_employee())
with check (
    auth.uid() = id
    -- Prevent self-activation or deactivation unless possessing users.deactivate
    and (is_active = (select is_active from public.user_profiles where id = auth.uid())
         or public.has_effective_permission(auth.uid(), 'users.deactivate'))
);

create policy "Admin user creation requires users.create permission"
on public.user_profiles for insert
with check (public.has_effective_permission(auth.uid(), 'users.create'));

create policy "Admin profile updates require users.update permission"
on public.user_profiles for update
using (public.has_effective_permission(auth.uid(), 'users.update'))
with check (public.has_effective_permission(auth.uid(), 'users.update'));

-- -----------------------------------------------------------------------------
-- 3. Roles Policies
-- -----------------------------------------------------------------------------
create policy "Active employees can view roles"
on public.roles for select
using (public.is_active_employee());

create policy "Create role requires roles.create permission"
on public.roles for insert
with check (public.has_effective_permission(auth.uid(), 'roles.create'));

create policy "Update role requires roles.update permission"
on public.roles for update
using (public.has_effective_permission(auth.uid(), 'roles.update'))
with check (public.has_effective_permission(auth.uid(), 'roles.update'));

create policy "Delete custom role requires roles.update permission"
on public.roles for delete
using (
    is_canonical = false
    and public.has_effective_permission(auth.uid(), 'roles.update')
);

-- -----------------------------------------------------------------------------
-- 4. Permissions Catalog Policies
-- -----------------------------------------------------------------------------
create policy "Active employees can view permissions catalog"
on public.permissions for select
using (public.is_active_employee());

-- Permissions catalog is read-only for normal users; insert/update restricted to Super Admin
create policy "Only super admin can modify permissions catalog"
on public.permissions for all
using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role_id = 'SUPER_ADMIN')
);

-- -----------------------------------------------------------------------------
-- 5. Role Permissions (Editable Permission Matrix) Policies
-- -----------------------------------------------------------------------------
create policy "Active employees can view role permissions"
on public.role_permissions for select
using (public.is_active_employee());

create policy "Manage role permissions requires roles.update permission"
on public.role_permissions for all
using (public.has_effective_permission(auth.uid(), 'roles.update'))
with check (public.has_effective_permission(auth.uid(), 'roles.update'));

-- -----------------------------------------------------------------------------
-- 6. User Roles Assignment Policies
-- -----------------------------------------------------------------------------
create policy "Active employees can view user role assignments"
on public.user_roles for select
using (public.is_active_employee());

create policy "Assign or revoke role requires roles.assign permission"
on public.user_roles for all
using (
    -- Prevent self-promotion: Acting user cannot assign a role to themselves
    auth.uid() != user_id
    and public.has_effective_permission(auth.uid(), 'roles.assign')
)
with check (
    auth.uid() != user_id
    and public.has_effective_permission(auth.uid(), 'roles.assign')
);

-- -----------------------------------------------------------------------------
-- 7. Sales Territories & Reporting Relationships Policies
-- -----------------------------------------------------------------------------
create policy "Active employees can view sales regions and teams"
on public.sales_regions for select
using (public.is_active_employee());

create policy "Active employees can view sales teams"
on public.sales_teams for select
using (public.is_active_employee());

create policy "Active employees can view sales reporting relationships"
on public.sales_reporting_relationships for select
using (public.is_active_employee());

create policy "Manage reporting relationships requires users.update permission"
on public.sales_reporting_relationships for all
using (public.has_effective_permission(auth.uid(), 'users.update'))
with check (public.has_effective_permission(auth.uid(), 'users.update'));

-- -----------------------------------------------------------------------------
-- 8. Foundational Business Table (Leads) with RLS Hierarchy & Permissions
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    first_name text not null,
    last_name text not null,
    email text,
    phone text,
    company_name text,
    status text not null default 'new',
    lead_owner_id uuid references public.user_profiles(id) on delete set null,
    created_by_id uuid references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_leads_owner on public.leads(lead_owner_id);
create index if not exists idx_leads_status on public.leads(status);

alter table public.leads enable row level security;

-- SELECT Policy: Requires leads.view permission AND owner in accessible sales scope
create policy "View leads within accessible sales scope"
on public.leads for select
using (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and (
        lead_owner_id is null
        or lead_owner_id in (select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
    )
);

-- INSERT Policy: Requires leads.create permission (BDO denied by default, ASM/SSM/RSM/HOS/SuperAdmin allowed)
create policy "Create leads requires leads.create permission"
on public.leads for insert
with check (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.create')
);

-- UPDATE Policy: Requires leads.update permission AND record within sales scope
create policy "Update leads within accessible sales scope"
on public.leads for update
using (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.update')
    and (
        lead_owner_id is null
        or lead_owner_id in (select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
    )
)
with check (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.update')
);

-- DELETE Policy: Requires leads.delete permission (Managers / Admins only)
create policy "Delete leads requires leads.delete permission"
on public.leads for delete
using (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.delete')
    and (
        lead_owner_id is null
        or lead_owner_id in (select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
    )
);
