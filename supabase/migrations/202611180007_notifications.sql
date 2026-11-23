BEGIN;

-- 1. Create crm_notifications table
CREATE TABLE IF NOT EXISTS public.crm_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    url TEXT,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'lead', 'task', 'call', 'meeting', 'deal', 'system', 'campaign', 'account', 'contact')),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_notifications_user_read ON public.crm_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_created ON public.crm_notifications(created_at DESC);

-- 2. Add permissions
INSERT INTO public.permissions(id, module, action, description) VALUES
    ('notifications.view', 'notifications', 'view', 'View received notifications'),
    ('notifications.create', 'notifications', 'create', 'Create or send notifications'),
    ('notifications.update', 'notifications', 'update', 'Update or mark notifications read'),
    ('notifications.delete', 'notifications', 'delete', 'Delete notifications')
ON CONFLICT (id) DO NOTHING;

-- Grant notification permissions to all active roles
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.module = 'notifications'
ON CONFLICT DO NOTHING;

-- 3. Row Level Security
ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;

-- Select policy: users can only see notifications sent to them
DROP POLICY IF EXISTS crm_notifications_select_policy ON public.crm_notifications;
CREATE POLICY crm_notifications_select_policy ON public.crm_notifications
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
);

-- Insert policy: authenticated users can insert notifications
DROP POLICY IF EXISTS crm_notifications_insert_policy ON public.crm_notifications;
CREATE POLICY crm_notifications_insert_policy ON public.crm_notifications
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
);

-- Update policy: users can update (mark as read) their own notifications
DROP POLICY IF EXISTS crm_notifications_update_policy ON public.crm_notifications;
CREATE POLICY crm_notifications_update_policy ON public.crm_notifications
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);

-- Delete policy: users can delete their own notifications
DROP POLICY IF EXISTS crm_notifications_delete_policy ON public.crm_notifications;
CREATE POLICY crm_notifications_delete_policy ON public.crm_notifications
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_notifications TO authenticated;

-- 4. Helper Stored Functions
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
    END IF;

    UPDATE public.crm_notifications
    SET read = TRUE,
        read_at = NOW()
    WHERE user_id = auth.uid()
      AND read = FALSE;
      
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_url TEXT DEFAULT NULL,
    p_category TEXT DEFAULT 'general'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
    END IF;

    INSERT INTO public.crm_notifications (
        user_id,
        sender_id,
        title,
        message,
        url,
        category
    ) VALUES (
        p_user_id,
        auth.uid(),
        p_title,
        p_message,
        p_url,
        COALESCE(p_category, 'general')
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

COMMIT;
