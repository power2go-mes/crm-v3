BEGIN;

-- 1. Create opportunity_team_members table
CREATE TABLE IF NOT EXISTS public.opportunity_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    team_role TEXT NOT NULL DEFAULT 'Sales Rep' CHECK (team_role IN ('Sales Rep', 'Solutions Architect', 'Account Executive', 'Product Specialist', 'Deal Support', 'Executive Sponsor')),
    access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'edit')),
    split_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (split_percentage >= 0 AND split_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_opportunity_team_member UNIQUE (opportunity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_team_opp ON public.opportunity_team_members(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_team_user ON public.opportunity_team_members(user_id);

-- 2. Permissions
INSERT INTO public.permissions(id, module, action, description) VALUES
    ('opportunities.manage_team', 'opportunities', 'manage_team', 'Add/edit opportunity collaborators and revenue splits')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.id = 'opportunities.manage_team'
  AND r.name IN ('Super Administrator', 'Head of Sales', 'Regional Sales Manager', 'Senior Sales Manager', 'Area Sales Manager', 'Business Development Officer')
ON CONFLICT DO NOTHING;

-- 3. Row Level Security
ALTER TABLE public.opportunity_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opp_team_members_select ON public.opportunity_team_members;
CREATE POLICY opp_team_members_select ON public.opportunity_team_members
FOR SELECT TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'opportunities.view')
);

DROP POLICY IF EXISTS opp_team_members_manage ON public.opportunity_team_members;
CREATE POLICY opp_team_members_manage ON public.opportunity_team_members
FOR ALL TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'opportunities.manage_team')
)
WITH CHECK (
    public.has_effective_permission(auth.uid(), 'opportunities.manage_team')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_team_members TO authenticated;

-- 4. Stored Procedure to Add Member and Notify
CREATE OR REPLACE FUNCTION public.add_opportunity_team_member(
    p_opportunity_id UUID,
    p_user_id UUID,
    p_team_role TEXT,
    p_access_level TEXT,
    p_split_percentage NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_opp RECORD;
    v_member_id UUID;
BEGIN
    SELECT * INTO v_opp FROM public.opportunities WHERE id = p_opportunity_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Opportunity not found' USING errcode = 'P0002';
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
    IF p_user_id IS NOT NULL THEN
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

COMMIT;
