begin;
create function public.lead_save_form(p_id uuid,p_standard jsonb,p_custom jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  saved public.leads;
  field record;
  value jsonb;
  columns text;
  source_columns text;
  assignments text;
  allowed constant text[] := array['title','first_name','last_name','email','phone','fax','company_name',
    'status','lead_source','industry','no_of_employees','annual_revenue','country','state','city','zip_code',
    'requirements','sub_owner_id'];
begin
  if auth.uid() is null or not public.has_effective_permission(auth.uid(),
    case when p_id is null then 'leads.create' else 'leads.update' end) then
    raise exception 'Lead form unavailable' using errcode='42501';
  end if;
  if jsonb_typeof(p_standard) is distinct from 'object' or jsonb_typeof(p_custom) is distinct from 'object'
    or octet_length(p_standard::text)>65536 or octet_length(p_custom::text)>1048576 then
    raise exception 'Invalid Lead form';
  end if;
  if exists(select 1 from jsonb_object_keys(p_standard) as supplied(key) where not (key=any(allowed))) then
    raise exception 'Unknown Lead form field';
  end if;

  for field in select d.id,d.key,d.label,d.type,d.choices,d.is_custom,coalesce(r.required,d.required) required
    from public.crm_field_definitions d left join public.crm_field_requirements r on r.definition_id=d.id
    where d.module='leads' and not d.archived
  loop
    if field.is_custom then
      if not (p_custom ? field.key) then continue; end if;
      if not public.crm_shared_field_access(field.id,true) then
        raise exception 'Custom Lead field unavailable' using errcode='42501';
      end if;
      value := p_custom->field.key;
      if value <> 'null'::jsonb and (
        (field.type='number' and jsonb_typeof(value)<>'number')
        or (field.type='choice' and jsonb_typeof(value)<>'array')
        or (field.type not in ('number','choice') and jsonb_typeof(value)<>'string')
      ) then raise exception 'Invalid value for %',field.label; end if;
    elsif field.key=any(allowed) and not public.crm_shared_field_access(field.id,true) then
      -- Omit non-writable values sent by legacy standard controls.
      p_standard := p_standard-field.key;
    end if;
  end loop;

  select string_agg(format('%I',key),', '),string_agg(format('incoming.%I',key),', '),
    string_agg(format('%I=incoming.%I',key,key),', ')
  into columns,source_columns,assignments from jsonb_object_keys(p_standard) keys(key);
  if p_id is null then
    if columns is null then raise exception 'Lead form is empty'; end if;
    execute format('insert into public.leads (%s,lead_owner_id,created_by_id) select %s,auth.uid(),auth.uid()
      from jsonb_populate_record(null::public.leads,$1) incoming returning *',columns,source_columns)
      into saved using p_standard;
  elsif assignments is not null then
    execute format('update public.leads l set %s from jsonb_populate_record(null::public.leads,$1) incoming
      where l.id=$2 returning l.*',assignments) into saved using p_standard,p_id;
  else
    select * into saved from public.leads where id=p_id for update;
  end if;
  if saved.id is null then raise exception 'Lead is outside your scope' using errcode='42501'; end if;

  for field in select d.id,d.key,d.label from public.crm_field_definitions d
    left join public.crm_field_requirements r on r.definition_id=d.id
    where d.module='leads' and not d.archived and not d.is_custom and d.key=any(allowed)
      and coalesce(r.required,d.required) and public.crm_shared_field_access(d.id,true)
  loop
    if nullif(btrim(to_jsonb(saved)->>field.key),'') is null then
      raise exception '% is required',field.label using errcode='23514';
    end if;
  end loop;
  if p_custom <> '{}'::jsonb or exists(select 1 from public.crm_field_definitions d
    left join public.crm_field_requirements r on r.definition_id=d.id
    where d.module='leads' and d.is_custom and coalesce(r.required,d.required)
      and public.crm_shared_field_access(d.id,true)) then
    perform public.crm_shared_save_values('leads',saved.id::text,p_custom,true);
  end if;
  return saved.id;
end $$;
revoke all on function public.lead_save_form(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.lead_save_form(uuid,jsonb,jsonb) to authenticated;
commit;
