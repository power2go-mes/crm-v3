-- =============================================================================
-- FINLONEXA CRM v3 — Phase 1 Migration 00002: Canonical Roles, Permissions & RBAC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Roles Table
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
    id text primary key, -- 'SUPER_ADMIN', 'HEAD_OF_SALES', 'RSM', 'SSM', 'ASM', 'BDO' or custom slug
    name text not null,
    description text,
    is_canonical boolean not null default false,
    hierarchy_rank integer, -- 0 for SUPER_ADMIN, 10 for HEAD_OF_SALES, 20 for RSM, etc.
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Trigger to protect canonical roles from deletion or renaming
create or replace function public.check_canonical_role_protection()
returns trigger as $$
begin
    if tg_op = 'DELETE' and old.is_canonical = true then
        raise exception 'Protected role % cannot be deleted.', old.id;
    end if;

    if tg_op = 'UPDATE' and old.is_canonical = true then
        if old.id != new.id then
            raise exception 'Canonical role identifier % cannot be renamed.', old.id;
        end if;
        if new.is_canonical = false then
            raise exception 'Canonical role % cannot be demoted to non-canonical.', old.id;
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

create trigger trigger_canonical_role_protection
before update or delete on public.roles
for each row execute function public.check_canonical_role_protection();

create trigger trigger_roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Seed 6 Protected Canonical Roles
-- -----------------------------------------------------------------------------
insert into public.roles (id, name, description, is_canonical, hierarchy_rank)
values
    ('SUPER_ADMIN', 'Super Administrator', 'Full administrative authority across the entire organization.', true, 0),
    ('HEAD_OF_SALES', 'Head of Sales', 'Organization-wide sales executive overseeing all regional managers.', true, 10),
    ('RSM', 'Regional Sales Manager', 'Supervises sales operations and Senior Sales Managers within a region.', true, 20),
    ('SSM', 'Senior Sales Manager', 'Supervises Area Sales Managers and multiple sales territories.', true, 30),
    ('ASM', 'Area Sales Manager', 'Supervises front-line Business Development Officers in a territory.', true, 40),
    ('BDO', 'Business Development Officer', 'Front-line sales representative handling assigned accounts and leads.', true, 50)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    is_canonical = excluded.is_canonical,
    hierarchy_rank = excluded.hierarchy_rank;

-- -----------------------------------------------------------------------------
-- 3. Extensible Permissions Catalog
-- -----------------------------------------------------------------------------
create table if not exists public.permissions (
    id text primary key, -- e.g. 'leads.view', 'leads.create'
    module text not null,
    action text not null,
    description text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_permissions_module on public.permissions(module);

-- Seed comprehensive feature permissions
insert into public.permissions (id, module, action, description)
values
    -- Leads Module
    ('leads.view', 'leads', 'view', 'View leads within authorized scope'),
    ('leads.create', 'leads', 'create', 'Create new leads'),
    ('leads.update', 'leads', 'update', 'Edit leads within authorized scope'),
    ('leads.delete', 'leads', 'delete', 'Delete leads within authorized scope'),
    ('leads.assign', 'leads', 'assign', 'Assign leads to subordinates'),
    ('leads.export', 'leads', 'export', 'Export leads data to CSV/Excel'),

    -- Accounts Module
    ('accounts.view', 'accounts', 'view', 'View accounts within authorized scope'),
    ('accounts.create', 'accounts', 'create', 'Create new accounts'),
    ('accounts.update', 'accounts', 'update', 'Edit accounts within authorized scope'),
    ('accounts.delete', 'accounts', 'delete', 'Delete accounts within authorized scope'),

    -- Contacts Module
    ('contacts.view', 'contacts', 'view', 'View contacts within authorized scope'),
    ('contacts.create', 'contacts', 'create', 'Create new contacts'),
    ('contacts.update', 'contacts', 'update', 'Edit contacts within authorized scope'),
    ('contacts.delete', 'contacts', 'delete', 'Delete contacts within authorized scope'),

    -- Opportunities Module
    ('opportunities.view', 'opportunities', 'view', 'View opportunities within authorized scope'),
    ('opportunities.create', 'opportunities', 'create', 'Create new opportunities'),
    ('opportunities.update', 'opportunities', 'update', 'Edit opportunities within authorized scope'),
    ('opportunities.delete', 'opportunities', 'delete', 'Delete opportunities within authorized scope'),

    -- User Management Module
    ('users.view', 'users', 'view', 'View employee user profiles'),
    ('users.create', 'users', 'create', 'Provision new employee user accounts'),
    ('users.update', 'users', 'update', 'Update employee profiles and reporting assignments'),
    ('users.deactivate', 'users', 'deactivate', 'Deactivate employee user accounts'),

    -- Role & RBAC Management Module
    ('roles.view', 'roles', 'view', 'View role catalog and permission matrices'),
    ('roles.create', 'roles', 'create', 'Create custom roles'),
    ('roles.update', 'roles', 'update', 'Edit configurable role permissions'),
    ('roles.assign', 'roles', 'assign', 'Assign roles to employee users'),

    -- Settings Module
    ('settings.view', 'settings', 'view', 'View company configuration and operational settings'),
    ('settings.update', 'settings', 'update', 'Update company operational configuration')
on conflict (id) do update set
    description = excluded.description;

-- -----------------------------------------------------------------------------
-- 4. Role-Permissions Mapping (Configurable by Admin)
-- -----------------------------------------------------------------------------
create table if not exists public.role_permissions (
    role_id text references public.roles(id) on delete cascade,
    permission_id text references public.permissions(id) on delete cascade,
    is_granted boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (role_id, permission_id)
);

-- Seed Initial Permissions Matrix
-- Rule: SUPER_ADMIN, HEAD_OF_SALES, RSM, SSM, ASM have leads.create = true; BDO has leads.create = false
insert into public.role_permissions (role_id, permission_id, is_granted)
select 'SUPER_ADMIN', id, true from public.permissions
on conflict (role_id, permission_id) do update set is_granted = excluded.is_granted;

-- Head of Sales
insert into public.role_permissions (role_id, permission_id, is_granted)
values
    ('HEAD_OF_SALES', 'leads.view', true),
    ('HEAD_OF_SALES', 'leads.create', true),
    ('HEAD_OF_SALES', 'leads.update', true),
    ('HEAD_OF_SALES', 'leads.delete', true),
    ('HEAD_OF_SALES', 'leads.assign', true),
    ('HEAD_OF_SALES', 'leads.export', true),
    ('HEAD_OF_SALES', 'accounts.view', true),
    ('HEAD_OF_SALES', 'accounts.create', true),
    ('HEAD_OF_SALES', 'accounts.update', true),
    ('HEAD_OF_SALES', 'accounts.delete', true),
    ('HEAD_OF_SALES', 'contacts.view', true),
    ('HEAD_OF_SALES', 'contacts.create', true),
    ('HEAD_OF_SALES', 'contacts.update', true),
    ('HEAD_OF_SALES', 'contacts.delete', true),
    ('HEAD_OF_SALES', 'opportunities.view', true),
    ('HEAD_OF_SALES', 'opportunities.create', true),
    ('HEAD_OF_SALES', 'opportunities.update', true),
    ('HEAD_OF_SALES', 'opportunities.delete', true),
    ('HEAD_OF_SALES', 'users.view', true),
    ('HEAD_OF_SALES', 'roles.view', true),
    ('HEAD_OF_SALES', 'settings.view', true)
on conflict (role_id, permission_id) do update set is_granted = excluded.is_granted;

-- RSM (Regional Sales Manager)
insert into public.role_permissions (role_id, permission_id, is_granted)
values
    ('RSM', 'leads.view', true),
    ('RSM', 'leads.create', true),
    ('RSM', 'leads.update', true),
    ('RSM', 'leads.delete', false),
    ('RSM', 'leads.assign', true),
    ('RSM', 'leads.export', true),
    ('RSM', 'accounts.view', true),
    ('RSM', 'accounts.create', true),
    ('RSM', 'accounts.update', true),
    ('RSM', 'accounts.delete', false),
    ('RSM', 'contacts.view', true),
    ('RSM', 'contacts.create', true),
    ('RSM', 'contacts.update', true),
    ('RSM', 'contacts.delete', false),
    ('RSM', 'opportunities.view', true),
    ('RSM', 'opportunities.create', true),
    ('RSM', 'opportunities.update', true),
    ('RSM', 'opportunities.delete', false),
    ('RSM', 'users.view', true)
on conflict (role_id, permission_id) do update set is_granted = excluded.is_granted;

-- SSM (Senior Sales Manager)
insert into public.role_permissions (role_id, permission_id, is_granted)
values
    ('SSM', 'leads.view', true),
    ('SSM', 'leads.create', true),
    ('SSM', 'leads.update', true),
    ('SSM', 'leads.delete', false),
    ('SSM', 'leads.assign', true),
    ('SSM', 'leads.export', false),
    ('SSM', 'accounts.view', true),
    ('SSM', 'accounts.create', true),
    ('SSM', 'accounts.update', true),
    ('SSM', 'accounts.delete', false),
    ('SSM', 'contacts.view', true),
    ('SSM', 'contacts.create', true),
    ('SSM', 'contacts.update', true),
    ('SSM', 'contacts.delete', false),
    ('SSM', 'opportunities.view', true),
    ('SSM', 'opportunities.create', true),
    ('SSM', 'opportunities.update', true),
    ('SSM', 'opportunities.delete', false)
on conflict (role_id, permission_id) do update set is_granted = excluded.is_granted;

-- ASM (Area Sales Manager)
insert into public.role_permissions (role_id, permission_id, is_granted)
values
    ('ASM', 'leads.view', true),
    ('ASM', 'leads.create', true),
    ('ASM', 'leads.update', true),
    ('ASM', 'leads.delete', false),
    ('ASM', 'leads.assign', true),
    ('ASM', 'leads.export', false),
    ('ASM', 'accounts.view', true),
    ('ASM', 'accounts.create', true),
    ('ASM', 'accounts.update', true),
    ('ASM', 'accounts.delete', false),
    ('ASM', 'contacts.view', true),
    ('ASM', 'contacts.create', true),
    ('ASM', 'contacts.update', true),
    ('ASM', 'contacts.delete', false),
    ('ASM', 'opportunities.view', true),
    ('ASM', 'opportunities.create', true),
    ('ASM', 'opportunities.update', true),
    ('ASM', 'opportunities.delete', false)
on conflict (role_id, permission_id) do update set is_granted = excluded.is_granted;

-- BDO (Business Development Officer) - INITIAL RULE: leads.create is DENIED (not granted)
insert into public.role_permissions (role_id, permission_id, is_granted)
values
    ('BDO', 'leads.view', true),
    ('BDO', 'leads.create', false), -- Explicitly Denied by default
    ('BDO', 'leads.update', true),
    ('BDO', 'leads.delete', false),
    ('BDO', 'leads.assign', false),
    ('BDO', 'leads.export', false),
    ('BDO', 'accounts.view', true),
    ('BDO', 'accounts.create', true),
    ('BDO', 'accounts.update', true),
    ('BDO', 'accounts.delete', false),
    ('BDO', 'contacts.view', true),
    ('BDO', 'contacts.create', true),
    ('BDO', 'contacts.update', true),
    ('BDO', 'contacts.delete', false),
    ('BDO', 'opportunities.view', true),
    ('BDO', 'opportunities.create', true),
    ('BDO', 'opportunities.update', true),
    ('BDO', 'opportunities.delete', false)
on conflict (role_id, permission_id) do update set is_granted = excluded.is_granted;

-- -----------------------------------------------------------------------------
-- 5. User Roles Assignment Table
-- -----------------------------------------------------------------------------
create table if not exists public.user_roles (
    user_id uuid references public.user_profiles(id) on delete cascade,
    role_id text references public.roles(id) on delete cascade,
    assigned_by uuid references public.user_profiles(id) on delete set null,
    assigned_at timestamptz not null default now(),
    primary key (user_id, role_id)
);

create index if not exists idx_user_roles_role_id on public.user_roles(role_id);
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
