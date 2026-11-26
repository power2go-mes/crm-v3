begin;

create index if not exists idx_leads_import_match_email on public.leads (email);
create index if not exists idx_leads_import_match_phone on public.leads (phone);
create index if not exists idx_leads_import_match_first_name on public.leads (first_name);
create index if not exists idx_leads_import_match_last_name on public.leads (last_name);
create index if not exists idx_leads_import_match_company_name on public.leads (company_name);

drop function public.run_lead_import(uuid, jsonb, text, text[]);

create function public.run_lead_import(
  p_job uuid,
  p_mapping jsonb,
  p_mode text,
  p_match text[] default '{}',
  p_limit integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job public.crm_import_jobs;
  item jsonb;
  values_json jsonb;
  combined jsonb;
  existing_row jsonb;
  mapping record;
  required_field record;
  idx integer;
  row_no integer;
  next_row integer;
  total_rows integer;
  created integer;
  updated integer;
  errors jsonb;
  outcome jsonb;
  is_complete boolean;
  started_at timestamptz;
  cols text;
  fields_sql text;
  match_sql text;
  target_ids uuid[];
  target_id uuid;
  allowed text[] := array[
    'title', 'first_name', 'last_name', 'email', 'phone', 'company_name',
    'status', 'lead_source', 'industry', 'no_of_employees', 'annual_revenue',
    'country', 'state', 'city', 'zip_code', 'fax', 'requirements'
  ];
begin
  if not public.has_effective_permission(auth.uid(), 'imports.view')
    or not public.has_effective_permission(auth.uid(), 'imports.create')
    or not public.has_effective_permission(auth.uid(), 'leads.view')
    or not public.has_effective_permission(auth.uid(), 'leads.create')
    or (p_mode in ('update', 'both') and not public.has_effective_permission(auth.uid(), 'leads.update'))
  then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if p_limit is null or p_limit not between 1 and 250
    or p_mode is null or p_mode not in ('create', 'update', 'both')
    or p_mapping is null or jsonb_typeof(p_mapping) <> 'object' or p_mapping = '{}'::jsonb
    or p_match is null or cardinality(p_match) > 5
    or (p_mode in ('update', 'both') and cardinality(p_match) = 0)
    or exists (
      select 1 from unnest(p_match) k
      where k is null
        or not (k = any(array['email', 'phone', 'first_name', 'last_name', 'company_name']))
        or not (p_mapping ? k)
    )
  then
    raise exception 'Invalid import configuration' using errcode = '23514';
  end if;

  select * into job
  from public.crm_import_jobs
  where id = p_job and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'Import unavailable' using errcode = '42501';
  end if;

  total_rows := jsonb_array_length(job.rows);
  if job.completed_at is not null then
    return coalesce(job.result, '{}'::jsonb) || jsonb_build_object(
      'complete', true,
      'processed_rows', coalesce((job.result ->> 'total_rows')::integer, total_rows)
    );
  end if;

  if job.configuration is null then
    job.configuration := jsonb_build_object(
      'mapping', p_mapping,
      'mode', p_mode,
      'match', to_jsonb(p_match),
      'next_row', 0,
      'started_at', clock_timestamp()
    );
    next_row := 0;
    started_at := clock_timestamp();
  else
    if job.configuration -> 'mapping' is distinct from p_mapping
      or job.configuration ->> 'mode' is distinct from p_mode
      or job.configuration -> 'match' is distinct from to_jsonb(p_match)
    then
      raise exception 'Import configuration cannot change after processing starts' using errcode = '23514';
    end if;
    next_row := coalesce((job.configuration ->> 'next_row')::integer, 0);
    started_at := coalesce((job.configuration ->> 'started_at')::timestamptz, clock_timestamp());
  end if;

  if exists (
    select 1
    from public.crm_field_definitions d
    left join public.crm_field_requirements q on q.definition_id = d.id
    where d.module = 'leads'
      and d.is_custom
      and not d.archived
      and coalesce(q.required, d.required)
  ) then
    raise exception 'Required custom fields need a supported import mapping before this import can run' using errcode = '23514';
  end if;

  for mapping in select * from jsonb_each(p_mapping) loop
    if not (mapping.key = any(allowed))
      or jsonb_typeof(mapping.value) <> 'number'
      or mapping.value::text !~ '^[0-9]+$'
    then
      raise exception 'Invalid mapped field' using errcode = '23514';
    end if;
    idx := (mapping.value::text)::integer;
    if idx >= jsonb_array_length(job.headers) then
      raise exception 'Invalid mapped column' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.crm_field_definitions d
      where d.module = 'leads'
        and d.key = mapping.key
        and not public.crm_shared_field_access(d.id, true)
    ) then
      raise exception 'Field write denied' using errcode = '42501';
    end if;
  end loop;

  select string_agg(format('%I', key), ','), string_agg(format('r.%I', key), ',')
    into cols, fields_sql
    from jsonb_each(p_mapping);
  select string_agg(format('l.%I::text = $1->>%L', k, k), ' and ')
    into match_sql
    from unnest(p_match) k;

  created := coalesce((job.result ->> 'created_count')::integer, 0);
  updated := coalesce((job.result ->> 'updated_count')::integer, 0);
  errors := coalesce(job.result -> 'errors', '[]'::jsonb);
  row_no := next_row;

  for item in
    select row_data
    from jsonb_array_elements(job.rows) with ordinality as input_rows(row_data, row_position)
    where row_position > next_row and row_position <= next_row + p_limit
    order by row_position
  loop
    row_no := row_no + 1;
    begin
      values_json := '{}'::jsonb;
      existing_row := null;
      target_id := null;
      target_ids := null;

      for mapping in select * from jsonb_each(p_mapping) loop
        if mapping.key in ('annual_revenue', 'no_of_employees') then
          values_json := values_json || jsonb_build_object(
            mapping.key, nullif(btrim(item ->> ((mapping.value::text)::integer)), '')
          );
        else
          values_json := values_json || jsonb_build_object(
            mapping.key, btrim(item ->> ((mapping.value::text)::integer))
          );
        end if;
      end loop;

      if cardinality(p_match) > 0 then
        if exists (select 1 from unnest(p_match) k where coalesce(values_json ->> k, '') = '') then
          raise exception 'Blank match field' using errcode = '23514';
        end if;
        execute
          'select array_agg(id) from (select l.id from public.leads l where ' || match_sql || ' limit 2) matches'
          into target_ids using values_json;
        if cardinality(target_ids) > 1 then
          raise exception 'Ambiguous match' using errcode = '21000';
        end if;
        target_id := target_ids[1];
      end if;

      if p_mode = 'create' and target_id is not null then
        raise exception 'Duplicate match' using errcode = '23505';
      end if;
      if p_mode = 'update' and target_id is null then
        raise exception 'No matching record' using errcode = 'P0002';
      end if;
      if target_id is not null and p_mode in ('update', 'both') then
        select to_jsonb(l) into existing_row
        from public.leads l
        where id = target_id
        for update;
        if existing_row is null then
          raise exception 'Record unavailable' using errcode = '42501';
        end if;
      end if;

      combined := coalesce(existing_row, '{}'::jsonb) || values_json;
      if existing_row ->> 'is_convert' = 'true' then
        raise exception 'Converted Lead imports are not supported' using errcode = '23514';
      end if;
      if (values_json ? 'status')
        and (
          values_json ->> 'status' = 'convert'
          or not exists (select 1 from public.lead_statuses where id = values_json ->> 'status')
        )
      then
        raise exception 'Invalid Lead status' using errcode = '23514';
      end if;
      if length(coalesce(combined ->> 'first_name', '')) > 100
        or length(coalesce(combined ->> 'last_name', '')) > 100
        or length(coalesce(combined ->> 'title', '')) > 100
        or length(coalesce(combined ->> 'email', '')) > 254
        or (
          coalesce(combined ->> 'email', '') <> ''
          and combined ->> 'email' !~ '^[^[:space:]@]+@[^[:space:]@]+$'
        )
        or (combined ->> 'annual_revenue')::numeric < 0
        or (combined ->> 'no_of_employees')::integer < 0
      then
        raise exception 'Invalid Lead value' using errcode = '23514';
      end if;

      for required_field in
        select d.key
        from public.crm_field_definitions d
        left join public.crm_field_requirements q on q.definition_id = d.id
        where d.module = 'leads'
          and not d.is_custom
          and not d.archived
          and coalesce(q.required, d.required)
      loop
        if coalesce(combined ->> required_field.key, '') = '' then
          raise exception 'Required field missing' using errcode = '23514';
        end if;
      end loop;

      if existing_row is null then
        if not (p_mapping ? 'title') then
          values_json := values_json || jsonb_build_object('title', '');
          execute format(
            'insert into public.leads (title, %s) select r.title, %s from jsonb_populate_record(null::public.leads, $1) r returning id',
            cols, fields_sql
          ) into target_id using values_json;
        else
          execute format(
            'insert into public.leads (%s) select %s from jsonb_populate_record(null::public.leads, $1) r returning id',
            cols, fields_sql
          ) into target_id using values_json;
        end if;
        created := created + 1;
      else
        execute format(
          'update public.leads l set (%s) = (select %s from jsonb_populate_record(null::public.leads, $1) r) where l.id = $2 returning l.id',
          cols, fields_sql
        ) into target_id using values_json, target_id;
        if target_id is null then
          raise exception 'Record unavailable' using errcode = '42501';
        end if;
        updated := updated + 1;
      end if;
    exception when others then
      errors := errors || jsonb_build_array(jsonb_build_object(
        'row', row_no,
        'code', sqlstate,
        'message', case sqlstate
          when '23505' then 'Duplicate matching record.'
          when '21000' then 'Multiple matching records.'
          when 'P0002' then 'No matching record.'
          when '42501' then 'Record or field permission denied.'
          when '23514' then 'Required field or validation failed.'
          when '23502' then 'A required field is missing.'
          when '22P02' then 'Invalid field value.'
          else 'Row could not be imported.'
        end
      ));
    end;
  end loop;

  is_complete := row_no >= total_rows;
  outcome := jsonb_build_object(
    'total_rows', total_rows,
    'processed_rows', row_no,
    'complete', is_complete,
    'created_count', created,
    'updated_count', updated,
    'error_count', jsonb_array_length(errors),
    'errors', errors,
    'success_rate', round(100.0 * (created + updated) / greatest(row_no, 1), 2),
    'duration_seconds', extract(epoch from clock_timestamp() - started_at)
  );

  update public.crm_import_jobs
  set configuration = job.configuration || jsonb_build_object('next_row', row_no),
      result = outcome,
      status = case
        when not is_complete then 'ready'
        when jsonb_array_length(errors) = 0 then 'success'
        when created + updated > 0 then 'partial'
        else 'failed'
      end,
      completed_at = case when is_complete then clock_timestamp() else null end
  where id = p_job;

  return outcome;
end;
$$;

grant create on schema public to crm_import_executor;
alter function public.run_lead_import(uuid, jsonb, text, text[], integer) owner to crm_import_executor;
revoke create on schema public from crm_import_executor;
revoke all on function public.run_lead_import(uuid, jsonb, text, text[], integer) from public, anon, authenticated;
grant execute on function public.run_lead_import(uuid, jsonb, text, text[], integer) to authenticated;

commit;
