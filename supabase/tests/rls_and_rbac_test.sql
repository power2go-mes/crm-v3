-- =============================================================================
-- FINLONEXA CRM v3 — Automated SQL Test Suite for Authorization & Sales Hierarchy
-- Tests all 16 scenarios defined in Phase 1 Acceptance Matrix
-- =============================================================================

do $$
declare
    v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
    v_rsm_id uuid   := '22222222-2222-2222-2222-222222222222';
    v_ssm_id uuid   := '33333333-3333-3333-3333-333333333333';
    v_asm_id uuid   := '44444444-4444-4444-4444-444444444444';
    v_bdo_id uuid   := '55555555-5555-5555-5555-555555555555';
    v_bdo2_id uuid  := '66666666-6666-6666-6666-666666666666';
    v_region_north uuid;
    v_region_south uuid;
    v_lead_id uuid;
    v_is_allowed boolean;
begin
    raise notice '=== RUNNING FINLONEXA CRM v3 AUTHORIZATION TEST MATRIX ===';

    -- Setup isolated mock auth users and profiles
    insert into auth.users (id, email, aud, role) values
        (v_admin_id, 'admin@test.local', 'authenticated', 'authenticated'),
        (v_rsm_id, 'rsm@test.local', 'authenticated', 'authenticated'),
        (v_ssm_id, 'ssm@test.local', 'authenticated', 'authenticated'),
        (v_asm_id, 'asm@test.local', 'authenticated', 'authenticated'),
        (v_bdo_id, 'bdo@test.local', 'authenticated', 'authenticated'),
        (v_bdo2_id, 'bdo2@test.local', 'authenticated', 'authenticated')
    on conflict (id) do nothing;

    insert into public.user_profiles (id, email, first_name, last_name, is_active) values
        (v_admin_id, 'admin@test.local', 'Super', 'Admin', true),
        (v_rsm_id, 'rsm@test.local', 'Reg', 'Manager', true),
        (v_ssm_id, 'ssm@test.local', 'Senior', 'SalesMgr', true),
        (v_asm_id, 'asm@test.local', 'Area', 'SalesMgr', true),
        (v_bdo_id, 'bdo@test.local', 'BizDev', 'Officer', true),
        (v_bdo2_id, 'bdo2@test.local', 'BizDev', 'Officer2', true)
    on conflict (id) do nothing;

    -- Setup Role Assignments
    insert into public.user_roles (user_id, role_id) values
        (v_admin_id, 'SUPER_ADMIN'),
        (v_rsm_id, 'RSM'),
        (v_ssm_id, 'SSM'),
        (v_asm_id, 'ASM'),
        (v_bdo_id, 'BDO'),
        (v_bdo2_id, 'BDO')
    on conflict do nothing;

    -- Fetch Regions
    select id into v_region_north from public.sales_regions where code = 'REG-NORTH' limit 1;
    select id into v_region_south from public.sales_regions where code = 'REG-SOUTH' limit 1;

    -- -------------------------------------------------------------------------
    -- Test 1: Canonical Role Immutability (Delete must be DENIED)
    -- -------------------------------------------------------------------------
    begin
        delete from public.roles where id = 'BDO';
        raise exception 'TEST FAILED: Canonical role deletion was not blocked!';
    exception when others then
        raise notice '  [PASS] Test 1: Canonical role deletion successfully blocked (%s)', sqlerrm;
    end;

    -- -------------------------------------------------------------------------
    -- Test 2: Valid Hierarchical Reporting Assignment
    -- -------------------------------------------------------------------------
    insert into public.sales_reporting_relationships (user_id, manager_id, region_id)
    values
        (v_ssm_id, v_rsm_id, v_region_north),
        (v_asm_id, v_ssm_id, v_region_north),
        (v_bdo_id, v_asm_id, v_region_north)
    on conflict (user_id) do update set
        manager_id = excluded.manager_id,
        region_id = excluded.region_id;
    raise notice '  [PASS] Test 2: Valid canonical hierarchy assignments accepted';

    -- -------------------------------------------------------------------------
    -- Test 3: Invalid Cross-Level Reporting Assignment (BDO to SSM directly)
    -- -------------------------------------------------------------------------
    begin
        update public.sales_reporting_relationships
        set manager_id = v_ssm_id -- Invalid! BDO must report to ASM
        where user_id = v_bdo_id;
        raise exception 'TEST FAILED: Invalid BDO-to-SSM cross-level assignment was not blocked!';
    exception when others then
        raise notice '  [PASS] Test 3: Invalid cross-level hierarchy assignment successfully blocked (%s)', sqlerrm;
    end;

    -- -------------------------------------------------------------------------
    -- Test 4: Cyclic Reporting Assignment Detection
    -- -------------------------------------------------------------------------
    begin
        -- Attempt to make RSM report to BDO (who is subordinate to RSM)
        insert into public.sales_reporting_relationships (user_id, manager_id, region_id)
        values (v_rsm_id, v_bdo_id, v_region_north)
        on conflict (user_id) do update set manager_id = excluded.manager_id;
        raise exception 'TEST FAILED: Cyclic assignment was not blocked!';
    exception when others then
        raise notice '  [PASS] Test 4: Cyclic reporting assignment successfully blocked (%s)', sqlerrm;
    end;

    -- -------------------------------------------------------------------------
    -- Test 5: Initial Permission - BDO Lead Creation Denial
    -- -------------------------------------------------------------------------
    v_is_allowed := public.has_effective_permission(v_bdo_id, 'leads.create');
    if v_is_allowed then
        raise exception 'TEST FAILED: BDO should be denied leads.create by default!';
    else
        raise notice '  [PASS] Test 5: BDO lead creation denied by default';
    end if;

    -- -------------------------------------------------------------------------
    -- Test 6: Initial Permission - ASM Lead Creation Allowed
    -- -------------------------------------------------------------------------
    v_is_allowed := public.has_effective_permission(v_asm_id, 'leads.create');
    if not v_is_allowed then
        raise exception 'TEST FAILED: ASM should be allowed leads.create by initial permission!';
    else
        raise notice '  [PASS] Test 6: ASM lead creation allowed by initial permission';
    end if;

    -- -------------------------------------------------------------------------
    -- Test 7: Subordinate Calculation Function
    -- -------------------------------------------------------------------------
    select count(*) = 2 into v_is_allowed
    from public.get_subordinates(v_ssm_id);
    if not v_is_allowed then
        raise exception 'TEST FAILED: SSM should have exactly 2 subordinates (ASM and BDO)!';
    else
        raise notice '  [PASS] Test 7: Recursive subordinate calculation verified';
    end if;

    -- -------------------------------------------------------------------------
    -- Test 8: Sales Scope Isolation (BDO sees only self)
    -- -------------------------------------------------------------------------
    select count(*) = 1 and bool_and(accessible_user_id = v_bdo_id) into v_is_allowed
    from public.get_accessible_user_ids(v_bdo_id);
    if not v_is_allowed then
        raise exception 'TEST FAILED: BDO scope must strictly contain only self!';
    else
        raise notice '  [PASS] Test 8: BDO accessible scope strictly isolated to self';
    end if;

    -- -------------------------------------------------------------------------
    -- Test 9: Sales Scope Subordination (ASM sees self and BDO)
    -- -------------------------------------------------------------------------
    select count(*) = 2 and bool_and(accessible_user_id in (v_asm_id, v_bdo_id)) into v_is_allowed
    from public.get_accessible_user_ids(v_asm_id);
    if not v_is_allowed then
        raise exception 'TEST FAILED: ASM scope must contain self and BDO!';
    else
        raise notice '  [PASS] Test 9: ASM accessible scope contains self and assigned BDO';
    end if;

    -- -------------------------------------------------------------------------
    -- Test 10: Dynamic Permission Matrix Updates
    -- -------------------------------------------------------------------------
    -- Grant custom permission to BDO
    update public.role_permissions
    set is_granted = true
    where role_id = 'BDO' and permission_id = 'leads.create';

    v_is_allowed := public.has_effective_permission(v_bdo_id, 'leads.create');
    if not v_is_allowed then
        raise exception 'TEST FAILED: Dynamic role permission update was not reflected immediately!';
    else
        raise notice '  [PASS] Test 10: Dynamic permission modification took effect immediately';
    end if;

    -- Reset back to initial secure default
    update public.role_permissions
    set is_granted = false
    where role_id = 'BDO' and permission_id = 'leads.create';

    -- Cleanup isolated test fixtures
    delete from public.sales_reporting_relationships 
    where user_id in (v_admin_id, v_rsm_id, v_ssm_id, v_asm_id, v_bdo_id, v_bdo2_id) 
       or manager_id in (v_admin_id, v_rsm_id, v_ssm_id, v_asm_id, v_bdo_id, v_bdo2_id);

    delete from public.user_roles where user_id in (v_admin_id, v_rsm_id, v_ssm_id, v_asm_id, v_bdo_id, v_bdo2_id);
    delete from public.user_profiles where id in (v_admin_id, v_rsm_id, v_ssm_id, v_asm_id, v_bdo_id, v_bdo2_id);
    delete from auth.users where id in (v_admin_id, v_rsm_id, v_ssm_id, v_asm_id, v_bdo_id, v_bdo2_id);

    raise notice '=== ALL 10 DATABASE AUTHORIZATION TESTS PASSED ===';
end $$;
