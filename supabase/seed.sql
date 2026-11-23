-- =============================================================================
-- FINLONEXA CRM v3 — Database Seed Data (Safe Baseline Fixtures)
-- =============================================================================

-- 1. Ensure Company Settings exist
insert into public.company_settings (id, company_name, time_zone, currency)
values (1, 'FINLONEXA', 'Asia/Kolkata', 'INR')
on conflict (id) do nothing;

-- 2. Baseline Sales Regions
insert into public.sales_regions (name, code)
values
    ('North Region', 'REG-NORTH'),
    ('South Region', 'REG-SOUTH'),
    ('East Region', 'REG-EAST'),
    ('West Region', 'REG-WEST')
on conflict (code) do nothing;

-- 3. Baseline Sales Teams
insert into public.sales_teams (name, region_id)
select 'North Corporate Sales', id from public.sales_regions where code = 'REG-NORTH'
on conflict do nothing;

insert into public.sales_teams (name, region_id)
select 'South Commercial Sales', id from public.sales_regions where code = 'REG-SOUTH'
on conflict do nothing;

-- 4. Secure Superadmin Bootstrap Procedure
-- This function can be called once with a valid auth.users UUID to bootstrap the first administrator
create or replace function public.bootstrap_initial_superadmin(admin_user_id uuid)
returns void as $$
begin
    -- Ensure user profile exists
    insert into public.user_profiles (id, email, first_name, last_name, is_active)
    select u.id, u.email, 'System', 'Administrator', true
    from auth.users u where u.id = admin_user_id
    on conflict (id) do update set is_active = true;

    -- Assign SUPER_ADMIN role
    insert into public.user_roles (user_id, role_id)
    values (admin_user_id, 'SUPER_ADMIN')
    on conflict do nothing;
end;
$$ language plpgsql security definer;
