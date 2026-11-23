begin;
create function public.lead_bulk_change(p_ids uuid[], p_status text default null)
returns integer language plpgsql security invoker set search_path=pg_catalog,public as $$
declare affected integer;
begin
  if coalesce(cardinality(p_ids),0) not between 1 and 500
     or cardinality(p_ids) <> (select count(distinct id) from unnest(p_ids) as chosen(id)) then
    raise exception 'Select between 1 and 500 distinct Leads.' using errcode='22023';
  end if;
  if p_status is null then
    if not public.has_effective_permission(auth.uid(),'leads.delete') then
      raise exception 'Lead deletion is unavailable.' using errcode='42501';
    end if;
    -- Converted Leads retain provenance. The attachment guard also applies.
    delete from public.leads where id=any(p_ids) and not is_convert;
  else
    if not public.has_effective_permission(auth.uid(),'leads.update') then
      raise exception 'Lead update is unavailable.' using errcode='42501';
    end if;
    if not exists (select 1 from public.lead_statuses where id=p_status and not is_final) then
      raise exception 'Choose a non-final Lead stage.' using errcode='22023';
    end if;
    update public.leads set status=p_status where id=any(p_ids) and not is_convert;
  end if;
  get diagnostics affected=row_count;
  if affected <> cardinality(p_ids) then
    raise exception 'One or more selected Leads are unavailable for this action.' using errcode='42501';
  end if;
  return affected;
end $$;
revoke all on function public.lead_bulk_change(uuid[],text) from public, anon;
grant execute on function public.lead_bulk_change(uuid[],text) to authenticated;
commit;
