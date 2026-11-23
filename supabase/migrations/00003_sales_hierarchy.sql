-- =============================================================================
-- FINLONEXA CRM v3 — Phase 1 Migration 00003: Sales Hierarchy & Scoping Engine
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sales Regions and Teams
-- -----------------------------------------------------------------------------
create table if not exists public.sales_regions (
    id uuid primary key default gen_random_uuid(),
    name text unique not null,
    code text unique not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.sales_teams (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    region_id uuid references public.sales_regions(id) on delete cascade,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Sales Reporting Relationships Table
-- -----------------------------------------------------------------------------
create table if not exists public.sales_reporting_relationships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique not null references public.user_profiles(id) on delete cascade,
    manager_id uuid references public.user_profiles(id) on delete set null,
    region_id uuid references public.sales_regions(id) on delete set null,
    team_id uuid references public.sales_teams(id) on delete set null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_sales_reporting_user on public.sales_reporting_relationships(user_id);
create index if not exists idx_sales_reporting_manager on public.sales_reporting_relationships(manager_id);
create index if not exists idx_sales_reporting_region on public.sales_reporting_relationships(region_id);
create index if not exists idx_sales_reporting_team on public.sales_reporting_relationships(team_id);

create trigger trigger_sales_reporting_updated_at
before update on public.sales_reporting_relationships
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Recursive Subordinate Calculation Function
-- -----------------------------------------------------------------------------
create or replace function public.get_subordinates(p_user_id uuid)
returns table (subordinate_id uuid, depth integer) as $$
begin
    return query
    with recursive reporting_tree as (
        -- Base level: direct reports
        select srr.user_id as sub_id, 1 as lvl
        from public.sales_reporting_relationships srr
        where srr.manager_id = p_user_id and srr.is_active = true

        union all

        -- Recursive step: indirect reports
        select srr.user_id as sub_id, rt.lvl + 1
        from public.sales_reporting_relationships srr
        inner join reporting_tree rt on srr.manager_id = rt.sub_id
        where srr.is_active = true
    )
    select sub_id, lvl from reporting_tree;
end;
$$ language plpgsql stable security definer;

-- -----------------------------------------------------------------------------
-- 4. Hierarchy Validation Trigger (Anti-Cycle & Canonical Role Sequence)
-- -----------------------------------------------------------------------------
create or replace function public.validate_sales_reporting_relationship()
returns trigger as $$
declare
    v_user_role text;
    v_manager_role text;
    v_is_subordinate boolean;
begin
    -- 1. Disallow self-reporting
    if new.user_id = new.manager_id then
        raise exception 'Employee cannot report to themselves.';
    end if;

    -- 2. Cycle Detection: Check if prospective manager is already a subordinate of this user
    if new.manager_id is not null then
        select exists (
            select 1 from public.get_subordinates(new.user_id) where subordinate_id = new.manager_id
        ) into v_is_subordinate;

        if v_is_subordinate then
            raise exception 'Cyclic reporting relationship detected: Manager is already a subordinate of employee.';
        end if;
    end if;

    -- 3. Cross-Level Hierarchy Validation for Canonical Roles
    -- Fetch primary canonical role of user and manager
    select r.id into v_user_role
    from public.user_roles ur
    inner join public.roles r on ur.role_id = r.id
    where ur.user_id = new.user_id and r.is_canonical = true
    order by r.hierarchy_rank asc limit 1;

    if new.manager_id is not null then
        select r.id into v_manager_role
        from public.user_roles ur
        inner join public.roles r on ur.role_id = r.id
        where ur.user_id = new.manager_id and r.is_canonical = true
        order by r.hierarchy_rank asc limit 1;
    end if;

    -- Enforce canonical reporting pairs if both are canonical
    if v_user_role is not null and v_manager_role is not null then
        if v_user_role = 'BDO' and v_manager_role != 'ASM' then
            raise exception 'Invalid hierarchy assignment: BDO must report directly to an ASM (attempted assignment to %).', v_manager_role;
        elsif v_user_role = 'ASM' and v_manager_role != 'SSM' then
            raise exception 'Invalid hierarchy assignment: ASM must report directly to an SSM (attempted assignment to %).', v_manager_role;
        elsif v_user_role = 'SSM' and v_manager_role != 'RSM' then
            raise exception 'Invalid hierarchy assignment: SSM must report directly to an RSM (attempted assignment to %).', v_manager_role;
        elsif v_user_role = 'RSM' and v_manager_role != 'HEAD_OF_SALES' then
            raise exception 'Invalid hierarchy assignment: RSM must report directly to Head of Sales (attempted assignment to %).', v_manager_role;
        elsif v_user_role = 'HEAD_OF_SALES' and v_manager_role != 'SUPER_ADMIN' then
            raise exception 'Invalid hierarchy assignment: Head of Sales must report to Super Admin (attempted assignment to %).', v_manager_role;
        end if;
    end if;

    -- 4. BDO Mandatory Manager Rule: An active BDO must have an assigned manager
    if v_user_role = 'BDO' and new.is_active = true and new.manager_id is null then
        raise exception 'Active BDO must belong to exactly one ASM.';
    end if;

    return new;
end;
$$ language plpgsql;

create trigger trigger_validate_sales_reporting
before insert or update on public.sales_reporting_relationships
for each row execute function public.validate_sales_reporting_relationship();

-- -----------------------------------------------------------------------------
-- 5. Permission Resolution Function (has_effective_permission)
-- -----------------------------------------------------------------------------
create or replace function public.has_effective_permission(p_user_id uuid, p_permission_id text)
returns boolean as $$
declare
    v_has_superadmin boolean;
    v_is_granted boolean;
begin
    -- Super Admin check
    select exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_user_id and ur.role_id = 'SUPER_ADMIN'
    ) into v_has_superadmin;

    if v_has_superadmin then
        return true;
    end if;

    -- Check if ANY assigned role has this permission granted
    select bool_or(rp.is_granted) into v_is_granted
    from public.user_roles ur
    inner join public.role_permissions rp on ur.role_id = rp.role_id
    where ur.user_id = p_user_id and rp.permission_id = p_permission_id;

    return coalesce(v_is_granted, false);
end;
$$ language plpgsql stable security definer;

-- -----------------------------------------------------------------------------
-- 6. Accessible Record Scoping Function (get_accessible_user_ids)
-- -----------------------------------------------------------------------------
create or replace function public.get_accessible_user_ids(p_acting_user_id uuid)
returns table (accessible_user_id uuid) as $$
declare
    v_role text;
    v_region_id uuid;
begin
    -- Determine user's top canonical role
    select r.id into v_role
    from public.user_roles ur
    inner join public.roles r on ur.role_id = r.id
    where ur.user_id = p_acting_user_id and r.is_canonical = true
    order by r.hierarchy_rank asc limit 1;

    -- SUPER_ADMIN or HEAD_OF_SALES can access all employees in the organization
    if v_role in ('SUPER_ADMIN', 'HEAD_OF_SALES') then
        return query select id from public.user_profiles where is_active = true;
        return;
    end if;

    -- RSM accesses all employees in their regional subtree
    if v_role = 'RSM' then
        select srr.region_id into v_region_id
        from public.sales_reporting_relationships srr
        where srr.user_id = p_acting_user_id and srr.is_active = true limit 1;

        if v_region_id is not null then
            return query
            select distinct srr.user_id
            from public.sales_reporting_relationships srr
            where srr.region_id = v_region_id and srr.is_active = true;
            return;
        end if;
    end if;

    -- SSM or ASM accesses self + recursive subordinates
    if v_role in ('SSM', 'ASM') then
        return query
        select p_acting_user_id as accessible_user_id
        union
        select subordinate_id from public.get_subordinates(p_acting_user_id);
        return;
    end if;

    -- BDO accesses self only
    return query select p_acting_user_id as accessible_user_id;
end;
$$ language plpgsql stable security definer;
