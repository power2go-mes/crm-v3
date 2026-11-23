BEGIN;

-- 1. Create crm_lead_capture_forms table
CREATE TABLE IF NOT EXISTS public.crm_lead_capture_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_name TEXT NOT NULL,
    selected_fields JSONB NOT NULL DEFAULT '["first_name", "last_name", "email", "phone", "company_name"]'::jsonb,
    lead_owner_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    return_url_enable BOOLEAN NOT NULL DEFAULT FALSE,
    return_url TEXT,
    success_message TEXT NOT NULL DEFAULT 'Thank you for reaching out!',
    success_description TEXT DEFAULT 'One of our representatives will contact you shortly.',
    header_color TEXT DEFAULT '#2563EB',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    submission_count INTEGER NOT NULL DEFAULT 0,
    created_by_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_capture_forms_active ON public.crm_lead_capture_forms(is_active, created_at DESC);

-- 2. Permissions
INSERT INTO public.permissions(id, module, action, description) VALUES
    ('leads.manage_web_forms', 'leads', 'manage_web_forms', 'Create, edit, and configure Web-to-Lead capture forms')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.id = 'leads.manage_web_forms'
  AND r.name IN ('Super Administrator', 'Head of Sales', 'Regional Sales Manager', 'Senior Sales Manager')
ON CONFLICT DO NOTHING;

-- 3. Row Level Security
ALTER TABLE public.crm_lead_capture_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_lead_capture_forms_select ON public.crm_lead_capture_forms;
CREATE POLICY crm_lead_capture_forms_select ON public.crm_lead_capture_forms
FOR SELECT TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'leads.view')
);

DROP POLICY IF EXISTS crm_lead_capture_forms_manage ON public.crm_lead_capture_forms;
CREATE POLICY crm_lead_capture_forms_manage ON public.crm_lead_capture_forms
FOR ALL TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'leads.manage_web_forms')
)
WITH CHECK (
    public.has_effective_permission(auth.uid(), 'leads.manage_web_forms')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_capture_forms TO authenticated;

-- Allow web-to-lead submissions in validate_lead_sub_owner trigger
create or replace function public.validate_lead_sub_owner() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if (auth.uid() is null or not public.is_active_employee()) and new.lead_source is distinct from 'website' then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if new.lead_source = 'website' then
      if new.created_by_id is null then
        new.created_by_id := new.lead_owner_id;
      end if;
    else
      if not public.has_effective_permission(auth.uid(),'leads.create') then
        raise exception 'Lead creation denied' using errcode='42501';
      end if;
      new.lead_owner_id=auth.uid();
      new.created_by_id=auth.uid();
    end if;
  else
    if new.lead_owner_id is distinct from old.lead_owner_id
      or new.created_by_id is distinct from old.created_by_id then
      raise exception 'Lead owner and creator are immutable' using errcode='42501';
    end if;
  end if;
  if (tg_op='INSERT' and new.sub_owner_id is not null)
    or (tg_op='UPDATE' and new.sub_owner_id is distinct from old.sub_owner_id) then
    if auth.uid() is not null and (not public.has_effective_permission(auth.uid(),'leads.update') or not exists(
      select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.is_active
      where ur.user_id=auth.uid() and ur.role_id in ('ASM','SUPER_ADMIN')
    )) then raise exception 'Only an authorized ASM may assign a BDO' using errcode='42501'; end if;
    if new.sub_owner_id is not null and not exists(
      select 1 from public.user_profiles u
      join public.user_roles ur on ur.user_id=u.id and ur.role_id='BDO'
      join public.roles r on r.id=ur.role_id and r.is_active
      where u.id=new.sub_owner_id and u.is_active
        and (exists(select 1 from public.sales_reporting_relationships s where s.user_id=u.id
          and s.manager_id=auth.uid() and s.is_active)
          or exists(select 1 from public.user_roles x where x.user_id=auth.uid() and x.role_id='SUPER_ADMIN'))
    ) then raise exception 'Choose an active directly reporting BDO' using errcode='42501'; end if;
  end if;
  if new.annual_revenue<0 or new.no_of_employees<0 then raise exception 'Values must be nonnegative'; end if;
  new.updated_at=now();
  return new;
end $$;
revoke all on function public.validate_lead_sub_owner() from public,anon,authenticated;

-- 4. Public Web-to-Lead Submission Stored Procedure
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
    v_requirements TEXT;
    v_owner_id UUID;
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

    -- Dispatch notification to lead owner if owner exists
    IF v_owner_id IS NOT NULL THEN
        INSERT INTO public.crm_notifications (
            user_id,
            title,
            message,
            url,
            category
        ) VALUES (
            v_owner_id,
            'New Web-to-Lead: ' || COALESCE(NULLIF(v_company, ''), v_first_name || ' ' || v_last_name),
            'A new lead was submitted via ' || v_form.form_name || '.',
            '/leads/' || v_lead_id,
            'lead'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', v_lead_id,
        'return_url', CASE WHEN v_form.return_url_enable THEN v_form.return_url ELSE NULL END,
        'message', v_form.success_message,
        'description', v_form.success_description
    );
END;
$$;

COMMIT;
