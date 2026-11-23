-- =============================================================================
-- FINLONEXA CRM v3 — Phase 05A: Security Hardening, Opportunity Team Access & Lead Assignment Automation
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Helper Function: Check Opportunity Team Membership (Breaks RLS Recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_opportunity_team_member(
    p_opp_id UUID,
    p_user_id UUID,
    p_required_level TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.opportunity_team_members
        WHERE opportunity_id = p_opp_id
          AND user_id = p_user_id
          AND (p_required_level IS NULL OR access_level = p_required_level)
    );
$$;

REVOKE ALL ON FUNCTION public.is_opportunity_team_member(UUID, UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_opportunity_team_member(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Update Opportunity RLS Policies for Team Collaborators
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS opportunities_scoped_read ON public.opportunities;
CREATE POLICY opportunities_scoped_read ON public.opportunities
FOR SELECT TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'opportunities.view')
    AND (
        owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
        OR public.is_opportunity_team_member(id, auth.uid())
    )
);

-- Helper function to check account existence without triggering RLS scoping barriers
CREATE OR REPLACE FUNCTION public.account_exists(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id);
$$;

REVOKE ALL ON FUNCTION public.account_exists(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_exists(UUID) TO authenticated;

DROP POLICY IF EXISTS opportunities_scoped_update ON public.opportunities;
CREATE POLICY opportunities_scoped_update ON public.opportunities
FOR UPDATE TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'opportunities.update')
    AND (
        owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
        OR public.is_opportunity_team_member(id, auth.uid(), 'edit')
    )
)
WITH CHECK (
    public.has_effective_permission(auth.uid(), 'opportunities.update')
    AND (
        owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
        OR public.is_opportunity_team_member(id, auth.uid(), 'edit')
    )
    AND (account_id IS NULL OR public.account_exists(account_id))
);

-- Trigger to prevent team members from changing deal ownership
CREATE OR REPLACE FUNCTION public.guard_opportunity_owner_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        IF auth.uid() IS NOT NULL THEN
            IF OLD.owner_id NOT IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid())) THEN
                RAISE EXCEPTION 'Opportunity team members cannot reassign deal ownership. Only deal owners, hierarchy managers, or administrators can transfer ownership.'
                    USING errcode = '42501';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_opportunity_owner_update ON public.opportunities;
CREATE TRIGGER trg_guard_opportunity_owner_update
BEFORE UPDATE OF owner_id ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.guard_opportunity_owner_update();

-- -----------------------------------------------------------------------------
-- 3. Hardened Opportunity Team Management Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS opp_team_members_manage ON public.opportunity_team_members;
CREATE POLICY opp_team_members_manage ON public.opportunity_team_members
FOR ALL TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'opportunities.manage_team')
    AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_team_members.opportunity_id
          AND o.owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
    )
)
WITH CHECK (
    public.has_effective_permission(auth.uid(), 'opportunities.manage_team')
    AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_team_members.opportunity_id
          AND o.owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
    )
);

-- -----------------------------------------------------------------------------
-- 4. Hardened add_opportunity_team_member Function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_opportunity_team_member(
    p_opportunity_id UUID,
    p_user_id UUID,
    p_team_role TEXT,
    p_access_level TEXT,
    p_split_percentage NUMERIC DEFAULT 0.00
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_opp RECORD;
    v_member_id UUID;
    v_current_user UUID := auth.uid();
BEGIN
    SELECT * INTO v_opp FROM public.opportunities WHERE id = p_opportunity_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Opportunity not found' USING errcode = 'P0002';
    END IF;

    -- Security validation: Only owner or hierarchy manager can manage team members
    IF v_current_user IS NOT NULL THEN
        IF NOT public.has_effective_permission(v_current_user, 'opportunities.manage_team') THEN
            RAISE EXCEPTION 'Permission denied to manage opportunity team' USING errcode = '42501';
        END IF;
        IF v_opp.owner_id NOT IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(v_current_user)) THEN
            RAISE EXCEPTION 'Access denied: can only manage teams for opportunities within your hierarchy' USING errcode = '42501';
        END IF;
    END IF;

    -- User validation: Must be an active user
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Cannot add inactive user to opportunity team' USING errcode = 'P0003';
    END IF;

    INSERT INTO public.opportunity_team_members (
        opportunity_id,
        user_id,
        team_role,
        access_level,
        split_percentage
    ) VALUES (
        p_opportunity_id,
        p_user_id,
        COALESCE(p_team_role, 'Sales Rep'),
        COALESCE(p_access_level, 'read'),
        COALESCE(p_split_percentage, 0.00)
    )
    ON CONFLICT (opportunity_id, user_id)
    DO UPDATE SET
        team_role = EXCLUDED.team_role,
        access_level = EXCLUDED.access_level,
        split_percentage = EXCLUDED.split_percentage
    RETURNING id INTO v_member_id;

    -- Send in-app notification to collaborator
    IF p_user_id IS NOT NULL AND (v_current_user IS NULL OR p_user_id != v_current_user) THEN
        INSERT INTO public.crm_notifications (
            user_id,
            title,
            message,
            url,
            category
        ) VALUES (
            p_user_id,
            'Deal Team: ' || v_opp.name,
            'You were added as ' || p_team_role || ' on deal "' || v_opp.name || '" with ' || p_split_percentage || '% split.',
            '/opportunities/' || p_opportunity_id,
            'deal'
        );
    END IF;

    RETURN v_member_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Hardened Lead Assignment Engine (Active User Check & Fallback Safety)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_and_assign_lead(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lead RECORD;
    v_rule RECORD;
    v_target_user_id UUID;
    v_user_count INTEGER;
    v_next_idx INTEGER;
    v_crit JSONB;
    v_field TEXT;
    v_op TEXT;
    v_val TEXT;
    v_lead_val TEXT;
    v_all_matched BOOLEAN;
    v_i INTEGER;
    v_candidate_id UUID;
    v_valid_user_found BOOLEAN;
    v_attempts INTEGER;
BEGIN
    PERFORM set_config('crm.allow_reassign', 'on', true);
    SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found' USING errcode = 'P0002';
    END IF;

    -- Evaluate active rules in created order
    FOR v_rule IN
        SELECT * FROM public.crm_lead_assignment_rules
        WHERE is_active = TRUE
        ORDER BY created_at ASC
    LOOP
        v_all_matched := TRUE;

        -- If criteria array is empty, default match
        IF jsonb_array_length(v_rule.criteria) > 0 THEN
            FOR v_i IN 0..(jsonb_array_length(v_rule.criteria) - 1) LOOP
                v_crit := v_rule.criteria->v_i;
                v_field := LOWER(TRIM(v_crit->>'field'));
                v_op := LOWER(TRIM(COALESCE(v_crit->>'operator', 'equals')));
                v_val := LOWER(TRIM(COALESCE(v_crit->>'value', '')));

                -- Fetch field value from lead
                IF v_field = 'country' THEN
                    v_lead_val := LOWER(COALESCE(v_lead.country, ''));
                ELSIF v_field = 'state' THEN
                    v_lead_val := LOWER(COALESCE(v_lead.state, ''));
                ELSIF v_field = 'industry' THEN
                    v_lead_val := LOWER(COALESCE(v_lead.industry, ''));
                ELSIF v_field = 'lead_source' THEN
                    v_lead_val := LOWER(COALESCE(v_lead.lead_source, ''));
                ELSIF v_field = 'company_name' THEN
                    v_lead_val := LOWER(COALESCE(v_lead.company_name, ''));
                ELSE
                    v_lead_val := '';
                END IF;

                -- Match operator
                IF v_op = 'equals' AND v_lead_val <> v_val THEN
                    v_all_matched := FALSE;
                    EXIT;
                ELSIF v_op = 'contains' AND POSITION(v_val IN v_lead_val) = 0 THEN
                    v_all_matched := FALSE;
                    EXIT;
                END IF;
            END LOOP;
        END IF;

        IF v_all_matched THEN
            v_target_user_id := NULL;
            v_valid_user_found := FALSE;

            -- Determine assignee
            IF v_rule.assign_to_type = 'round_robin' THEN
                v_user_count := COALESCE(array_length(v_rule.round_robin_user_ids, 1), 0);
                IF v_user_count > 0 THEN
                    -- Cycle through round robin to find next ACTIVE user
                    v_attempts := 0;
                    WHILE v_attempts < v_user_count LOOP
                        v_next_idx := ((v_rule.last_assigned_index + v_attempts) % v_user_count) + 1;
                        v_candidate_id := v_rule.round_robin_user_ids[v_next_idx];
                        
                        IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_candidate_id AND is_active = TRUE) THEN
                            v_target_user_id := v_candidate_id;
                            v_valid_user_found := TRUE;
                            
                            UPDATE public.crm_lead_assignment_rules
                            SET last_assigned_index = (v_rule.last_assigned_index + v_attempts + 1) % v_user_count,
                                updated_at = NOW()
                            WHERE id = v_rule.id;
                            EXIT;
                        END IF;
                        v_attempts := v_attempts + 1;
                    END LOOP;
                END IF;
            ELSE
                -- Direct user assignment
                IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_rule.assigned_user_id AND is_active = TRUE) THEN
                    v_target_user_id := v_rule.assigned_user_id;
                    v_valid_user_found := TRUE;
                END IF;
            END IF;

            -- Apply assignment if a valid active target user was found
            IF v_valid_user_found AND v_target_user_id IS NOT NULL THEN
                UPDATE public.leads
                SET lead_owner_id = v_target_user_id,
                    updated_at = NOW()
                WHERE id = p_lead_id;

                IF v_rule.notify THEN
                    INSERT INTO public.crm_notifications (
                        user_id,
                        title,
                        message,
                        url,
                        category
                    ) VALUES (
                        v_target_user_id,
                        'Lead Assigned: ' || COALESCE(v_lead.company_name, v_lead.first_name || ' ' || v_lead.last_name),
                        'Automated assignment via rule "' || v_rule.name || '".',
                        '/leads/' || p_lead_id,
                        'lead'
                    );
                END IF;

                RETURN jsonb_build_object(
                    'matched', true,
                    'rule_id', v_rule.id,
                    'rule_name', v_rule.name,
                    'assigned_to', v_target_user_id
                );
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('matched', false);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Connect Lead Assignment Engine to submit_web_to_lead
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_web_to_lead(
    p_form_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_form RECORD;
    v_lead_id UUID;
    v_recent_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
    v_email TEXT;
    v_phone TEXT;
    v_company TEXT;
    v_country TEXT;
    v_requirements TEXT;
    v_owner_id UUID;
    v_assignment_res JSONB;
BEGIN
    -- Check form existence and active status
    SELECT * INTO v_form FROM public.crm_lead_capture_forms WHERE id = p_form_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Web capture form not found or inactive' USING errcode = 'P0002';
    END IF;

    v_first_name := TRIM(COALESCE(p_payload->>'first_name', ''));
    v_last_name := TRIM(COALESCE(p_payload->>'last_name', ''));
    v_email := LOWER(TRIM(COALESCE(p_payload->>'email', '')));
    v_phone := TRIM(COALESCE(p_payload->>'phone', ''));
    v_company := TRIM(COALESCE(p_payload->>'company_name', p_payload->>'company', ''));
    v_country := TRIM(COALESCE(p_payload->>'country', ''));
    v_requirements := TRIM(COALESCE(p_payload->>'requirements', p_payload->>'message', ''));

    IF v_first_name = '' AND v_last_name = '' THEN
        v_first_name := 'Website';
        v_last_name := 'Inquiry';
    ELSIF v_last_name = '' THEN
        v_last_name := v_first_name;
        v_first_name := '';
    END IF;

    -- Pick lead owner: form owner or first superadmin / head of sales
    v_owner_id := v_form.lead_owner_id;
    IF v_owner_id IS NULL THEN
        SELECT u.id INTO v_owner_id
        FROM public.user_profiles u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = ur.role_id
        WHERE r.name IN ('Super Administrator', 'Head of Sales')
        LIMIT 1;
    END IF;

    -- Anti-spam duplicate check (within 5 minutes for same email)
    IF v_email <> '' THEN
        SELECT id INTO v_recent_id
        FROM public.leads
        WHERE email = v_email
          AND lead_source = 'website'
          AND created_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_recent_id IS NOT NULL THEN
            -- Duplicate within 5 minutes: gracefully return success without duplicating
            RETURN jsonb_build_object(
                'success', true,
                'duplicate_prevented', true,
                'lead_id', v_recent_id,
                'return_url', CASE WHEN v_form.return_url_enable THEN v_form.return_url ELSE NULL END,
                'message', v_form.success_message,
                'description', v_form.success_description
            );
        END IF;
    END IF;

    -- Insert new lead
    INSERT INTO public.leads (
        title,
        first_name,
        last_name,
        email,
        phone,
        company_name,
        country,
        requirements,
        lead_source,
        status,
        lead_owner_id,
        created_by_id
    ) VALUES (
        'Website Lead',
        v_first_name,
        v_last_name,
        NULLIF(v_email, ''),
        NULLIF(v_phone, ''),
        NULLIF(v_company, ''),
        COALESCE(NULLIF(v_country, ''), 'India'),
        NULLIF(v_requirements, ''),
        'website',
        'new',
        v_owner_id,
        v_owner_id
    )
    RETURNING id INTO v_lead_id;

    -- Increment form submission count
    UPDATE public.crm_lead_capture_forms
    SET submission_count = submission_count + 1,
        updated_at = NOW()
    WHERE id = p_form_id;

    -- AUTOMATION: Execute automated lead assignment rules
    v_assignment_res := public.evaluate_and_assign_lead(v_lead_id);

    -- Dispatch notification to fallback owner ONLY if rules did not assign to someone else
    IF (v_assignment_res->>'matched')::BOOLEAN IS NOT TRUE AND v_owner_id IS NOT NULL THEN
        INSERT INTO public.crm_notifications (
            user_id,
            title,
            message,
            url,
            category
        ) VALUES (
            v_owner_id,
            'New Inbound Lead: ' || COALESCE(NULLIF(v_company, ''), v_first_name || ' ' || v_last_name),
            'Submitted via form "' || v_form.form_name || '".',
            '/leads/' || v_lead_id,
            'lead'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', v_lead_id,
        'return_url', CASE WHEN v_form.return_url_enable THEN v_form.return_url ELSE NULL END,
        'message', v_form.success_message,
        'description', v_form.success_description,
        'assignment', v_assignment_res
    );
END;
$$;

COMMIT;
