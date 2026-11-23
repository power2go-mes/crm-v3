BEGIN;

-- 1. Create crm_lead_assignment_rules table
CREATE TABLE IF NOT EXISTS public.crm_lead_assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    assign_to_type TEXT NOT NULL DEFAULT 'user' CHECK (assign_to_type IN ('user', 'role', 'round_robin')),
    assigned_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    round_robin_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
    last_assigned_index INTEGER NOT NULL DEFAULT 0,
    notify BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_assignment_rules_active ON public.crm_lead_assignment_rules(is_active, created_at ASC);

-- 2. Permissions
INSERT INTO public.permissions(id, module, action, description) VALUES
    ('leads.manage_assignment_rules', 'leads', 'manage_assignment_rules', 'Configure automated lead routing and assignment rules')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.id = 'leads.manage_assignment_rules'
  AND r.name IN ('Super Administrator', 'Head of Sales', 'Regional Sales Manager', 'Senior Sales Manager')
ON CONFLICT DO NOTHING;

-- 3. Row Level Security
ALTER TABLE public.crm_lead_assignment_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_lead_assignment_rules_select ON public.crm_lead_assignment_rules;
CREATE POLICY crm_lead_assignment_rules_select ON public.crm_lead_assignment_rules
FOR SELECT TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'leads.view')
);

DROP POLICY IF EXISTS crm_lead_assignment_rules_manage ON public.crm_lead_assignment_rules;
CREATE POLICY crm_lead_assignment_rules_manage ON public.crm_lead_assignment_rules
FOR ALL TO authenticated
USING (
    public.has_effective_permission(auth.uid(), 'leads.manage_assignment_rules')
)
WITH CHECK (
    public.has_effective_permission(auth.uid(), 'leads.manage_assignment_rules')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_assignment_rules TO authenticated;

-- Allow lead reassignment by authorized routing engine
create or replace function public.validate_lead_sub_owner() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if (auth.uid() is null or not public.is_active_employee()) and new.lead_source is distinct from 'website' then
    if current_setting('crm.allow_reassign', true) is distinct from 'on' then
      raise exception 'Authentication required' using errcode='42501';
    end if;
  end if;
  if tg_op='INSERT' then
    if new.lead_source = 'website' then
      if new.created_by_id is null then
        new.created_by_id := new.lead_owner_id;
      end if;
    else
      if auth.uid() is not null and not public.has_effective_permission(auth.uid(),'leads.create') and current_setting('crm.allow_reassign', true) is distinct from 'on' then
        raise exception 'Lead creation denied' using errcode='42501';
      end if;
      if new.lead_owner_id is null and auth.uid() is not null then
        new.lead_owner_id=auth.uid();
      end if;
      if new.created_by_id is null and auth.uid() is not null then
        new.created_by_id=auth.uid();
      end if;
    end if;
  else
    if new.created_by_id is distinct from old.created_by_id then
      raise exception 'Lead creator is immutable' using errcode='42501';
    end if;
    if new.lead_owner_id is distinct from old.lead_owner_id then
      if auth.uid() is not null and not (
        public.has_effective_permission(auth.uid(), 'leads.manage_assignment_rules')
        or exists(select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_id in ('SUPER_ADMIN', 'HEAD_OF_SALES'))
      ) and current_setting('crm.allow_reassign', true) is distinct from 'on' then
        raise exception 'Lead owner is immutable without reassign permission' using errcode='42501';
      end if;
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

-- 4. Stored Procedure for Rule Evaluation and Auto-Assignment
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
            -- Determine assignee
            IF v_rule.assign_to_type = 'round_robin' THEN
                v_user_count := COALESCE(array_length(v_rule.round_robin_user_ids, 1), 0);
                IF v_user_count > 0 THEN
                    v_next_idx := (v_rule.last_assigned_index % v_user_count) + 1;
                    v_target_user_id := v_rule.round_robin_user_ids[v_next_idx];

                    UPDATE public.crm_lead_assignment_rules
                    SET last_assigned_index = last_assigned_index + 1,
                        updated_at = NOW()
                    WHERE id = v_rule.id;
                ELSE
                    v_target_user_id := v_rule.assigned_user_id;
                END IF;
            ELSE
                v_target_user_id := v_rule.assigned_user_id;
            END IF;

            IF v_target_user_id IS NOT NULL THEN
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

COMMIT;
