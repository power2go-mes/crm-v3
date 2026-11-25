-- Phase 5: Protect Public Web-to-Lead
-- 1. Redefine submit_web_to_lead to not return lead_id or distinguish duplicates
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
            -- Return generic response without disclosing existing ID
            RETURN jsonb_build_object(
                'success', true,
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

    -- Dynamic Assignment Rule evaluation
    BEGIN
        v_assignment_res := public.evaluate_and_assign_lead(v_lead_id);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Generic success output without record ID
    RETURN jsonb_build_object(
        'success', true,
        'return_url', CASE WHEN v_form.return_url_enable THEN v_form.return_url ELSE NULL END,
        'message', v_form.success_message,
        'description', v_form.success_description
    );
END;
$$;

-- 2. Revoke and grant explicit permissions
REVOKE ALL ON FUNCTION public.submit_web_to_lead(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_web_to_lead(UUID, JSONB) TO anon, authenticated, service_role;
