BEGIN;

-- 1. Create crm_recycle_bin table
CREATE TABLE IF NOT EXISTS public.crm_recycle_bin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL CHECK (model_name IN ('leads', 'accounts', 'contacts', 'opportunities', 'activities', 'departments', 'campaigns')),
    record_id TEXT NOT NULL,
    record_name TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    deleted_by_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_recycle_bin_model ON public.crm_recycle_bin(model_name, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_recycle_bin_deleted_at ON public.crm_recycle_bin(deleted_at DESC);

-- 2. Add permissions
INSERT INTO public.permissions(id, module, action, description) VALUES
    ('recycle_bin.view', 'recycle_bin', 'view', 'View soft-deleted records in Recycle Bin'),
    ('recycle_bin.restore', 'recycle_bin', 'restore', 'Restore deleted records from Recycle Bin'),
    ('recycle_bin.delete', 'recycle_bin', 'delete', 'Permanently delete records from Recycle Bin')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to Super Administrator and Head of Sales
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.module = 'recycle_bin'
  AND r.name IN ('Super Administrator', 'Head of Sales')
ON CONFLICT DO NOTHING;

-- 3. Row Level Security
ALTER TABLE public.crm_recycle_bin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_recycle_bin_select_policy ON public.crm_recycle_bin;
CREATE POLICY crm_recycle_bin_select_policy ON public.crm_recycle_bin
FOR SELECT TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'recycle_bin.view')
);

DROP POLICY IF EXISTS crm_recycle_bin_insert_policy ON public.crm_recycle_bin;
CREATE POLICY crm_recycle_bin_insert_policy ON public.crm_recycle_bin
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS crm_recycle_bin_delete_policy ON public.crm_recycle_bin;
CREATE POLICY crm_recycle_bin_delete_policy ON public.crm_recycle_bin
FOR DELETE TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'recycle_bin.delete')
    OR public.has_effective_permission(auth.uid(), 'recycle_bin.restore')
);

GRANT SELECT, INSERT, DELETE ON public.crm_recycle_bin TO authenticated;

-- 4. Stored Procedures
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
        -- Re-insert if missing
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
    END IF;

    -- Delete from recycle bin once restored
    DELETE FROM public.crm_recycle_bin WHERE id = p_recycle_id;
    RETURN TRUE;
END;
$$;

COMMIT;
