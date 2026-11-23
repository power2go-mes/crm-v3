-- ============================================================================
-- Migration: 202611230007_lead_stage_configuration.sql
-- Description: Lead Stage Configuration (R0721)
-- Adds permissions, management RLS policies, and RPCs for updating & reordering lead stages
-- Preserves the 6 approved canonical Lead stages: New, Contacted, Qualified, Proposal, Lost, Convert
-- ============================================================================

BEGIN;

-- 1. Register permission for managing lead stages
INSERT INTO public.permissions (id, module, action, description)
VALUES ('leads.manage_stages', 'leads', 'manage_stages', 'Configure lead pipeline stages, colors, and probabilities')
ON CONFLICT (id) DO NOTHING;

-- Grant permission to Super Admin and Head of Sales
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.id = 'leads.manage_stages'
  AND r.name IN ('Super Administrator', 'Head of Sales')
ON CONFLICT DO NOTHING;

-- Also link by canonical role id if user_roles uses canonical role codes
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.id = 'leads.manage_stages'
  AND r.id IN ('SUPER_ADMIN', 'HEAD_OF_SALES')
ON CONFLICT DO NOTHING;

-- 2. Add RLS policies for managing lead_statuses
DROP POLICY IF EXISTS lead_statuses_manage ON public.lead_statuses;
CREATE POLICY lead_statuses_manage ON public.lead_statuses
FOR ALL TO authenticated
USING (
  public.has_effective_permission(auth.uid(), 'leads.manage_stages')
  OR public.has_effective_permission(auth.uid(), 'settings.update')
)
WITH CHECK (
  public.has_effective_permission(auth.uid(), 'leads.manage_stages')
  OR public.has_effective_permission(auth.uid(), 'settings.update')
);

GRANT SELECT, INSERT, UPDATE ON public.lead_statuses TO authenticated, service_role;

-- 3. Stored Procedure: update_lead_stage
CREATE OR REPLACE FUNCTION public.update_lead_stage(
  p_stage_id text,
  p_name text,
  p_color text,
  p_probability numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_effective_permission(auth.uid(), 'leads.manage_stages')
    OR public.has_effective_permission(auth.uid(), 'settings.update')
  ) THEN
    RAISE EXCEPTION 'Permission denied: leads.manage_stages required' USING errcode = '42501';
  END IF;

  IF p_probability < 0 OR p_probability > 100 THEN
    RAISE EXCEPTION 'Probability must be between 0 and 100';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Stage name cannot be empty';
  END IF;

  UPDATE public.lead_statuses
  SET name = trim(p_name),
      color = coalesce(nullif(trim(p_color), ''), color),
      probability = p_probability
  WHERE id = p_stage_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead stage % not found', p_stage_id;
  END IF;

  RETURN to_jsonb(v_updated);
END;
$$;

-- 4. Stored Procedure: reorder_lead_stages
CREATE OR REPLACE FUNCTION public.reorder_lead_stages(p_stage_ids text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_i integer;
  v_id text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_effective_permission(auth.uid(), 'leads.manage_stages')
    OR public.has_effective_permission(auth.uid(), 'settings.update')
  ) THEN
    RAISE EXCEPTION 'Permission denied: leads.manage_stages required' USING errcode = '42501';
  END IF;

  IF p_stage_ids IS NULL OR array_length(p_stage_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Stage IDs array cannot be empty';
  END IF;

  FOR v_i IN 1..array_length(p_stage_ids, 1) LOOP
    v_id := p_stage_ids[v_i];
    UPDATE public.lead_statuses
    SET order_index = v_i
    WHERE id = v_id;
  END LOOP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_lead_stage(text, text, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reorder_lead_stages(text[]) TO authenticated, service_role;

COMMIT;
