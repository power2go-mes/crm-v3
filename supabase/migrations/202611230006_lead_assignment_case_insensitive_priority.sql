-- ============================================================================
-- Migration: 202611230006_lead_assignment_case_insensitive_priority.sql
-- Description: Implement case-insensitive, whitespace-trimmed lead assignment
-- criteria matching (CRM-AUDIT-006), rule priority ordering, and dynamic field support.
-- Preserves SECURITY DEFINER, active user checking, round-robin rotation, and notification.
-- ============================================================================

BEGIN;

-- 1. Add priority column to crm_lead_assignment_rules if not exists
ALTER TABLE public.crm_lead_assignment_rules
ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 1;

-- Backfill initial priority by creation sequence
WITH ordered_rules AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM public.crm_lead_assignment_rules
)
UPDATE public.crm_lead_assignment_rules r
SET priority = o.row_num
FROM ordered_rules o
WHERE r.id = o.id;

CREATE INDEX IF NOT EXISTS idx_crm_lead_assignment_rules_priority
ON public.crm_lead_assignment_rules(is_active, priority ASC, created_at ASC);

-- 2. Upgrade evaluate_and_assign_lead function with case-insensitive matching & priority
CREATE OR REPLACE FUNCTION public.evaluate_and_assign_lead(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lead RECORD;
    v_lead_json JSONB;
    v_rule RECORD;
    v_target_user_id UUID;
    v_user_count INTEGER;
    v_next_idx INTEGER;
    v_crit JSONB;
    v_field TEXT;
    v_op TEXT;
    v_val TEXT;
    v_raw_val TEXT;
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

    v_lead_json := to_jsonb(v_lead);

    -- Evaluate active rules in priority order (ascending priority number, then created_at)
    FOR v_rule IN
        SELECT * FROM public.crm_lead_assignment_rules
        WHERE is_active = TRUE
        ORDER BY priority ASC, created_at ASC
    LOOP
        v_all_matched := TRUE;

        -- If criteria array is empty, default match
        IF jsonb_array_length(v_rule.criteria) > 0 THEN
            FOR v_i IN 0..(jsonb_array_length(v_rule.criteria) - 1) LOOP
                v_crit := v_rule.criteria->v_i;
                v_field := LOWER(TRIM(v_crit->>'field'));
                v_op := LOWER(TRIM(COALESCE(v_crit->>'operator', 'equals')));
                v_val := LOWER(TRIM(COALESCE(v_crit->>'value', '')));

                -- Dynamic, case-insensitive, whitespace-trimmed field value extraction
                v_raw_val := v_lead_json->>v_field;
                v_lead_val := LOWER(TRIM(COALESCE(v_raw_val, '')));

                -- Execute normalized comparison
                IF v_op = 'equals' AND v_lead_val <> v_val THEN
                    v_all_matched := FALSE;
                    EXIT;
                ELSIF v_op = 'not_equals' AND v_lead_val = v_val THEN
                    v_all_matched := FALSE;
                    EXIT;
                ELSIF v_op = 'contains' AND POSITION(v_val IN v_lead_val) = 0 THEN
                    v_all_matched := FALSE;
                    EXIT;
                ELSIF v_op IN ('not_contains', 'does_not_contain') AND POSITION(v_val IN v_lead_val) > 0 THEN
                    v_all_matched := FALSE;
                    EXIT;
                ELSIF v_op = 'starts_with' AND NOT STARTS_WITH(v_lead_val, v_val) THEN
                    v_all_matched := FALSE;
                    EXIT;
                END IF;
            END LOOP;
        END IF;

        IF v_all_matched THEN
            v_target_user_id := NULL;
            v_valid_user_found := FALSE;

            -- Determine assignee based on strategy
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
                    'priority', v_rule.priority,
                    'assigned_to', v_target_user_id
                );
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('matched', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_and_assign_lead(UUID) TO authenticated, service_role, anon;

COMMIT;
