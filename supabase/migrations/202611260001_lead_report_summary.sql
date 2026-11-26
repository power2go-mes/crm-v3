begin;

create function public.leads_report_summary(p_report text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.has_effective_permission(auth.uid(), 'leads.view') then
    raise exception 'Lead report denied' using errcode = '42501';
  end if;

  if p_report is null or p_report not in ('leads-by-status', 'leads-by-source', 'converted-leads') then
    raise exception 'Unsupported Lead report' using errcode = '22023';
  end if;

  if p_report = 'leads-by-status' and exists (
    select 1
    from public.crm_field_definitions d
    where d.module = 'leads'
      and d.key in ('status', 'lead_status')
      and not public.crm_shared_field_access(d.id)
  ) then
    raise exception 'Lead report field denied' using errcode = '42501';
  end if;

  if p_report = 'leads-by-source' and exists (
    select 1
    from public.crm_field_definitions d
    where d.module = 'leads'
      and d.key = 'lead_source'
      and not public.crm_shared_field_access(d.id)
  ) then
    raise exception 'Lead report field denied' using errcode = '42501';
  end if;

  if p_report = 'converted-leads' then
    select jsonb_build_object(
      'total_count', count(*),
      'groups', case when count(*) = 0 then '[]'::jsonb
        else jsonb_build_array(jsonb_build_object('key', 'converted', 'label', 'Converted', 'count', count(*)))
      end
    )
    into result
    from public.leads l
    where l.is_convert or l.status = 'converted';
    return result;
  end if;

  if p_report = 'leads-by-status' then
    select jsonb_build_object(
      'total_count', coalesce(sum(g.record_count), 0),
      'groups', coalesce(
        jsonb_agg(jsonb_build_object('key', g.key, 'label', g.label, 'count', g.record_count)
          order by g.record_count desc, g.label),
        '[]'::jsonb
      )
    )
    into result
    from (
      select coalesce(l.status, 'unknown') as key,
        coalesce(s.name, l.status, 'Unknown') as label,
        count(*) as record_count
      from public.leads l
      left join public.lead_statuses s on s.id = l.status
      group by 1, 2
    ) g;
  else
    select jsonb_build_object(
      'total_count', coalesce(sum(g.record_count), 0),
      'groups', coalesce(
        jsonb_agg(jsonb_build_object('key', g.key, 'label', g.label, 'count', g.record_count)
          order by g.record_count desc, g.label),
        '[]'::jsonb
      )
    )
    into result
    from (
      select coalesce(nullif(l.lead_source, ''), 'unknown') as key,
        coalesce(nullif(l.lead_source, ''), 'Unknown') as label,
        count(*) as record_count
      from public.leads l
      group by 1, 2
    ) g;
  end if;

  return result;
end;
$$;

revoke all on function public.leads_report_summary(text) from public, anon;
grant execute on function public.leads_report_summary(text) to authenticated;

commit;
