begin;
create function public.lead_bulk_edit(p_ids uuid[], p_field text, p_value text)
returns integer language plpgsql security invoker set search_path=pg_catalog,public as $$
declare affected integer;
begin
  if not public.has_effective_permission(auth.uid(),'leads.view')
     or not public.has_effective_permission(auth.uid(),'leads.update')
     or exists(select 1 from public.crm_field_definitions d where d.module='leads'
        and (d.key=p_field or (p_field='status' and d.key='lead_status'))
        and not public.crm_shared_field_access(d.id,true)) then
    raise exception 'Lead field is unavailable for editing.' using errcode='42501';
  end if;
  if coalesce(cardinality(p_ids),0) not between 1 and 500
     or cardinality(p_ids) <> (select count(distinct id) from unnest(p_ids) chosen(id)) then
    raise exception 'Select between 1 and 500 distinct Leads.' using errcode='22023';
  end if;
  if p_value is null or length(p_value)>30 or (case p_field
    when 'status' then not exists(select 1 from public.lead_statuses where id=p_value and not is_final)
    when 'annual_revenue' then p_value !~ '^[0-9]{1,13}(\.[0-9]{1,2})?$'
    when 'no_of_employees' then p_value !~ '^[0-9]{1,10}$'
    when 'lead_source' then p_value not in ('website','referral','event','campaign','phone','email','social_media','partner','other')
    when 'industry' then p_value not in ('finance','healthcare','manufacturing','agriculture','construction','banking','education','insurance','other')
    else true end) then
    raise exception 'Invalid Lead field or value.' using errcode='22023';
  end if;
  update public.leads set
    status=case when p_field='status' then p_value else status end,
    annual_revenue=case when p_field='annual_revenue' then p_value::numeric else annual_revenue end,
    no_of_employees=case when p_field='no_of_employees' then p_value::integer else no_of_employees end,
    lead_source=case when p_field='lead_source' then p_value else lead_source end,
    industry=case when p_field='industry' then p_value else industry end
  where id=any(p_ids) and not is_convert;
  get diagnostics affected=row_count;
  if affected <> cardinality(p_ids) then
    raise exception 'One or more selected Leads are unavailable.' using errcode='42501';
  end if;
  return affected;
end $$;
revoke all on function public.lead_bulk_edit(uuid[],text,text) from public, anon;
grant execute on function public.lead_bulk_edit(uuid[],text,text) to authenticated;

create function public.log_lead_bulk_edit_fields() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into public.lead_history(lead_id,field_name,old_value,new_value,actor_id)
  select new.id, value.field, value.old_value, value.new_value, auth.uid()
  from (values ('annual_revenue',old.annual_revenue::text,new.annual_revenue::text),
    ('no_of_employees',old.no_of_employees::text,new.no_of_employees::text),
    ('lead_source',old.lead_source,new.lead_source),('industry',old.industry,new.industry))
    value(field,old_value,new_value) where value.old_value is distinct from value.new_value;
  return new;
end $$;
revoke all on function public.log_lead_bulk_edit_fields() from public, anon, authenticated;
create trigger lead_bulk_edit_history after update of annual_revenue,no_of_employees,lead_source,industry
on public.leads for each row execute function public.log_lead_bulk_edit_fields();
create policy lead_field_history_visibility on public.lead_history as restrictive for select to authenticated
using (not exists(select 1 from public.crm_field_definitions d where d.module='leads'
  and d.key=field_name and not public.crm_shared_field_access(d.id)));
commit;
