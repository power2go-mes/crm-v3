begin;
create or replace function public.leads_chart_aggregate(p_group text default 'status', p_value text default 'count', p_filters jsonb default '{}'::jsonb, p_converted boolean default false)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; dimension text;
begin
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),'leads.view') then
  raise exception 'Lead chart denied' using errcode='42501';
 end if;
 if p_group not in ('status','lead_source','industry') or (p_value<>'count' and (split_part(p_value,'__',1) not in ('sum','avg','min','max') or split_part(p_value,'__',2) not in ('annual_revenue','no_of_employees','lead_score'))) then
  raise exception 'Unsupported Lead chart selection' using errcode='22023';
 end if;
 dimension:=case when p_group='status' then 'status' else p_group end;
 if exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=dimension)
  and not exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=dimension and public.crm_shared_field_access(d.id)) then
  raise exception 'Lead chart field denied' using errcode='42501';
 end if;
 if p_value<>'count' and exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=split_part(p_value,'__',2))
  and not exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=split_part(p_value,'__',2) and public.crm_shared_field_access(d.id)) then
  raise exception 'Lead chart value denied' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('label',g.label,'value',g.value) order by g.value desc,g.label),'[]'::jsonb) into result
 from (
  select case p_group when 'status' then coalesce(s.name,'No stage') when 'lead_source' then coalesce(nullif(l.lead_source,''),'Unknown') else coalesce(nullif(l.industry,''),'Unknown') end label,
   case when p_value='count' then count(*)::numeric
    when split_part(p_value,'__',1)='sum' then coalesce(sum(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0)
    when split_part(p_value,'__',1)='avg' then coalesce(avg(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0)
    when split_part(p_value,'__',1)='min' then coalesce(min(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0)
    else coalesce(max(case split_part(p_value,'__',2) when 'annual_revenue' then l.annual_revenue when 'no_of_employees' then l.no_of_employees::numeric else l.lead_score::numeric end),0) end value
  from public.leads l left join public.lead_statuses s on s.id=l.status
  where l.is_convert=p_converted and (p_group<>'status' or coalesce(s.is_final,false)=false)
   and (coalesce(p_filters->>'search','')='' or l.title ilike '%'||(p_filters->>'search')||'%' or l.company_name ilike '%'||(p_filters->>'search')||'%' or l.first_name ilike '%'||(p_filters->>'search')||'%' or l.last_name ilike '%'||(p_filters->>'search')||'%' or l.email ilike '%'||(p_filters->>'search')||'%')
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
