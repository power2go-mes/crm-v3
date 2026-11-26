begin;

create or replace function public.evaluate_and_assign_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_lead record;
  v_lead_json jsonb;
  v_rule record;
  v_target_user_id uuid;
  v_user_count integer;
  v_next_idx integer;
  v_locked_index integer;
  v_crit jsonb;
  v_field text;
  v_op text;
  v_val text;
  v_raw_val text;
  v_lead_val text;
  v_all_matched boolean;
  v_i integer;
  v_candidate_id uuid;
  v_valid_user_found boolean;
  v_attempts integer;
begin
  perform set_config('crm.allow_reassign', 'on', true);

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  v_lead_json := to_jsonb(v_lead);

  for v_rule in
    select * from public.crm_lead_assignment_rules
    where is_active = true
    order by priority asc, created_at asc
  loop
    v_all_matched := true;

    if jsonb_array_length(v_rule.criteria) > 0 then
      for v_i in 0..(jsonb_array_length(v_rule.criteria) - 1) loop
        v_crit := v_rule.criteria->v_i;
        v_field := lower(trim(v_crit->>'field'));
        v_op := lower(trim(coalesce(v_crit->>'operator', 'equals')));
        v_val := lower(trim(coalesce(v_crit->>'value', '')));
        v_raw_val := v_lead_json->>v_field;
        v_lead_val := lower(trim(coalesce(v_raw_val, '')));

        if v_op = 'equals' and v_lead_val <> v_val then
          v_all_matched := false;
          exit;
        elsif v_op = 'not_equals' and v_lead_val = v_val then
          v_all_matched := false;
          exit;
        elsif v_op = 'contains' and position(v_val in v_lead_val) = 0 then
          v_all_matched := false;
          exit;
        elsif v_op in ('not_contains', 'does_not_contain') and position(v_val in v_lead_val) > 0 then
          v_all_matched := false;
          exit;
        elsif v_op = 'starts_with' and not starts_with(v_lead_val, v_val) then
          v_all_matched := false;
          exit;
        end if;
      end loop;
    end if;

    if v_all_matched then
      v_target_user_id := null;
      v_valid_user_found := false;

      if v_rule.assign_to_type = 'round_robin' then
        select * into v_rule
        from public.crm_lead_assignment_rules
        where id = v_rule.id and is_active = true
        for update;
        if not found then continue; end if;

        v_user_count := coalesce(array_length(v_rule.round_robin_user_ids, 1), 0);
        if v_user_count > 0 then
          v_attempts := 0;
          while v_attempts < v_user_count loop
            v_next_idx := ((v_rule.last_assigned_index + v_attempts) % v_user_count) + 1;
            v_candidate_id := v_rule.round_robin_user_ids[v_next_idx];

            if exists (
              select 1 from public.user_profiles
              where id = v_candidate_id and is_active = true
            ) then
              v_target_user_id := v_candidate_id;
              v_valid_user_found := true;
              update public.crm_lead_assignment_rules
              set last_assigned_index = (v_rule.last_assigned_index + v_attempts + 1) % v_user_count,
                  updated_at = now()
              where id = v_rule.id;
              exit;
            end if;
            v_attempts := v_attempts + 1;
          end loop;
        end if;
      else
        if exists (
          select 1 from public.user_profiles
          where id = v_rule.assigned_user_id and is_active = true
        ) then
          v_target_user_id := v_rule.assigned_user_id;
          v_valid_user_found := true;
        end if;
      end if;

      if v_valid_user_found and v_target_user_id is not null then
        update public.leads
        set lead_owner_id = v_target_user_id,
            updated_at = now()
        where id = p_lead_id;

        if v_rule.notify then
          insert into public.crm_notifications (
            user_id, title, message, url, category
          ) values (
            v_target_user_id,
            'Lead Assigned: ' || coalesce(v_lead.company_name, v_lead.first_name || ' ' || v_lead.last_name),
            'Automated assignment via rule "' || v_rule.name || '".',
            '/leads/' || p_lead_id,
            'lead'
          );
        end if;

        return jsonb_build_object(
          'matched', true,
          'rule_id', v_rule.id,
          'rule_name', v_rule.name,
          'priority', v_rule.priority,
          'assigned_to', v_target_user_id
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object('matched', false);
end;
$$;

revoke all on function public.evaluate_and_assign_lead(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_and_assign_lead(uuid) to service_role;

commit;
