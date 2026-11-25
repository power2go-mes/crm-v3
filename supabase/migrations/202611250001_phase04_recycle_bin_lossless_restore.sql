-- Phase 4: Extend restore_recycle_bin_item to support campaigns and atomic restore
CREATE OR REPLACE FUNCTION public.restore_recycle_bin_item(p_recycle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item RECORD;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.has_effective_permission(auth.uid(), 'recycle_bin.restore') THEN
        RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
    END IF;

    SELECT * INTO v_item FROM public.crm_recycle_bin WHERE id = p_recycle_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found in Recycle Bin' USING errcode = 'P0002';
    END IF;

    -- Handle restoration by model
    IF v_item.model_name = 'departments' THEN
        UPDATE public.departments SET deleted_at = NULL WHERE id = (v_item.record_id)::uuid;
    ELSIF v_item.model_name = 'leads' THEN
        INSERT INTO public.leads (id, title, first_name, last_name, company_name, email, phone, status, lead_source, lead_owner_id, created_by_id)
        VALUES (
            (v_item.record_id)::uuid,
            COALESCE(v_item.data->>'title', 'Mr'),
            COALESCE(v_item.data->>'first_name', 'Restored'),
            COALESCE(v_item.data->>'last_name', 'Lead'),
            v_item.data->>'company_name',
            v_item.data->>'email',
            v_item.data->>'phone',
            COALESCE(v_item.data->>'status', 'new'),
            v_item.data->>'lead_source',
            COALESCE((v_item.data->>'lead_owner_id')::uuid, v_item.deleted_by_id),
            COALESCE((v_item.data->>'created_by_id')::uuid, v_item.deleted_by_id)
        )
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    ELSIF v_item.model_name = 'accounts' THEN
        INSERT INTO public.accounts (id, name, industry, website, contact_number)
        VALUES (
            (v_item.record_id)::uuid,
            COALESCE(v_item.data->>'name', v_item.record_name),
            v_item.data->>'industry',
            v_item.data->>'website',
            v_item.data->>'contact_number'
        )
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    ELSIF v_item.model_name = 'contacts' THEN
        INSERT INTO public.contacts (id, first_name, last_name, email, phone)
        VALUES (
            (v_item.record_id)::uuid,
            COALESCE(v_item.data->>'first_name', 'Restored'),
            COALESCE(v_item.data->>'last_name', 'Contact'),
            v_item.data->>'email',
            v_item.data->>'phone'
        )
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    ELSIF v_item.model_name = 'opportunities' THEN
        INSERT INTO public.opportunities (id, name, stage, amount)
        VALUES (
            (v_item.record_id)::uuid,
            COALESCE(v_item.data->>'name', v_item.record_name),
            COALESCE(v_item.data->>'stage', 'Prospecting'),
            COALESCE((v_item.data->>'amount')::numeric, 0)
        )
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    ELSIF v_item.model_name = 'activities' THEN
        INSERT INTO public.activities (id, title, activity_type, status, priority)
        VALUES (
            (v_item.record_id)::uuid,
            COALESCE(v_item.data->>'title', v_item.record_name),
            COALESCE(v_item.data->>'activity_type', 'task'),
            COALESCE(v_item.data->>'status', 'pending'),
            COALESCE(v_item.data->>'priority', 'medium')
        )
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    ELSIF v_item.model_name = 'campaigns' THEN
        INSERT INTO public.campaigns (id, name, status, type, budget, start_date, end_date)
        VALUES (
            (v_item.record_id)::uuid,
            COALESCE(v_item.data->>'name', v_item.record_name),
            COALESCE(v_item.data->>'status', 'Planning'),
            COALESCE(v_item.data->>'type', 'Email'),
            COALESCE((v_item.data->>'budget')::numeric, 0),
            (v_item.data->>'start_date')::date,
            (v_item.data->>'end_date')::date
        )
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    END IF;

    -- Delete from recycle bin ONLY after successful restoration within this transaction
    DELETE FROM public.crm_recycle_bin WHERE id = p_recycle_id;
    RETURN TRUE;
END;
$$;
