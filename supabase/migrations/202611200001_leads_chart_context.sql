begin;
create or replace function public.leads_chart_aggregate(p_group text default 'status', p_value text default 'count', p_filters jsonb default '{}'::jsonb, p_converted boolean default false)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; dimension text; filtered_field text; search_term text;
begin
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),'leads.view') then
  raise exception 'Lead chart denied' using errcode='42501';
 end if;
 p_value:=case p_value when 'annual_revenue_sum' then 'sum__annual_revenue' when 'annual_revenue_avg' then 'avg__annual_revenue' else p_value end;
 if p_group not in ('status','lead_source','industry','sub_owner_id','created_at','created_by_id','updated_at') or (p_value<>'count' and (split_part(p_value,'__',1) not in ('sum','avg','min','max') or split_part(p_value,'__',2) not in ('annual_revenue','no_of_employees','lead_score'))) then
  raise exception 'Unsupported Lead chart selection' using errcode='22023';
 end if;
 dimension:=case p_group when 'sub_owner_id' then 'sub_owner' when 'created_by_id' then 'created_by' else p_group end;
 if exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=dimension)
  and not exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=dimension and public.crm_shared_field_access(d.id)) then
  raise exception 'Lead chart field denied' using errcode='42501';
 end if;
 if p_value<>'count' and exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=split_part(p_value,'__',2))
  and not exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=split_part(p_value,'__',2) and public.crm_shared_field_access(d.id)) then
  raise exception 'Lead chart value denied' using errcode='42501';
 end if;
 search_term:=replace(replace(replace(left(trim(coalesce(p_filters->>'search','')),200),chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_');
 for filtered_field in select f.field from (values
  ('status','status'),('source','lead_source'),('industry','industry'),('ownerId','lead_owner'),('subOwnerId','sub_owner'),
  ('dateFrom','created_at'),('dateTo','created_at'),('minRevenue','annual_revenue'),('maxRevenue','annual_revenue')
 ) f(input,field) where coalesce(p_filters->>f.input,'') not in ('','[]')
 loop
  if exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=filtered_field and not public.crm_shared_field_access(d.id)) then
   raise exception 'Lead chart filter denied' using errcode='42501';
  end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('label',g.label,'value',g.value) order by g.value desc,g.label),'[]'::jsonb) into result
 from (
  select case p_group when 'status' then coalesce(s.name,'No stage') when 'lead_source' then coalesce(nullif(l.lead_source,''),'Unknown') when 'industry' then coalesce(nullif(l.industry,''),'Unknown')
   when 'sub_owner_id' then coalesce(nullif(trim(concat_ws(' ',assignee.first_name,assignee.last_name)),''),'Unassigned')
   when 'created_by_id' then coalesce(nullif(trim(concat_ws(' ',creator.first_name,creator.last_name)),''),'Unknown')
   when 'created_at' then to_char(l.created_at at time zone 'UTC','YYYY-MM')
   else to_char(l.updated_at at time zone 'UTC','YYYY-MM') end label,
   case when p_value='count' then count(*)::numeric
    when split_part(p_value,'__',1)='sum' then coalesce(sum(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0)
    when split_part(p_value,'__',1)='avg' then coalesce(avg(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0)
    when split_part(p_value,'__',1)='min' then coalesce(min(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0)
    else coalesce(max(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0) end value
  from public.leads l left join public.lead_statuses s on s.id=l.status
   left join public.user_profiles assignee on assignee.id=l.sub_owner_id
   left join public.user_profiles creator on creator.id=l.created_by_id
  where l.is_convert=p_converted and (p_group<>'status' or coalesce(s.is_final,false)=false)
   and (search_term='' or exists (
    select 1 from (values ('title',l.title),('company_name',l.company_name),('first_name',l.first_name),('last_name',l.last_name),('email',l.email),('phone',l.phone)) candidate(key, field_value)
    where candidate.field_value ilike '%' || search_term || '%'
    and not exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=candidate.key and not public.crm_shared_field_access(d.id))
   ))
   and (not (p_filters ? 'recordIds') or l.id in (select id::uuid from jsonb_array_elements_text(p_filters->'recordIds') as ids(id)))
   and (coalesce(jsonb_array_length(coalesce(p_filters->'status','[]'::jsonb)),0)=0 or l.status in (select jsonb_array_elements_text(p_filters->'status')))
   and (coalesce(jsonb_array_length(coalesce(p_filters->'source','[]'::jsonb)),0)=0 or l.lead_source in (select jsonb_array_elements_text(p_filters->'source')))
   and (coalesce(jsonb_array_length(coalesce(p_filters->'industry','[]'::jsonb)),0)=0 or l.industry in (select jsonb_array_elements_text(p_filters->'industry')))
   and (nullif(p_filters->>'ownerId','') is null or l.lead_owner_id=(p_filters->>'ownerId')::uuid)
   and (nullif(p_filters->>'subOwnerId','') is null or l.sub_owner_id=(p_filters->>'subOwnerId')::uuid)
   and (nullif(p_filters->>'dateFrom','') is null or l.created_at >= (p_filters->>'dateFrom')::timestamptz)
   and (nullif(p_filters->>'dateTo','') is null or l.created_at < ((p_filters->>'dateTo')::date+1)::timestamptz)
   and (nullif(p_filters->>'minRevenue','') is null or l.annual_revenue >= (p_filters->>'minRevenue')::numeric)
   and (nullif(p_filters->>'maxRevenue','') is null or l.annual_revenue <= (p_filters->>'maxRevenue')::numeric)
  group by 1 order by 2 desc,1 limit 200
 ) g;
 return result;
end $$;
revoke all on function public.leads_chart_aggregate(text,text,jsonb,boolean) from public;
grant execute on function public.leads_chart_aggregate(text,text,jsonb,boolean) to authenticated;
commit;
