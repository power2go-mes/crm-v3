do $$
declare
  column_name text;
begin
  if not has_table_privilege('authenticated', 'public.crm_export_jobs', 'SELECT')
    or has_table_privilege('authenticated', 'public.crm_export_jobs', 'INSERT')
    or has_table_privilege('authenticated', 'public.crm_export_jobs', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crm_export_jobs', 'DELETE') then
    raise exception 'Authenticated table-level export-job grants are incorrect.';
  end if;

  if not has_column_privilege('authenticated', 'public.crm_export_jobs', 'module', 'INSERT')
    or not has_column_privilege('authenticated', 'public.crm_export_jobs', 'columns', 'INSERT')
    or not has_column_privilege('authenticated', 'public.crm_export_jobs', 'time_zone', 'INSERT') then
    raise exception 'Authenticated cannot insert the permitted export-job inputs.';
  end if;

  foreach column_name in array array[
    'id',
    'user_id',
    'module',
    'columns',
    'time_zone',
    'status',
    'cursor_id',
    'processed_rows',
    'part_count',
    'output_bytes',
    'storage_path',
    'error_message',
    'claim_token',
    'lease_expires_at',
    'created_at',
    'updated_at',
    'completed_at'
  ] loop
    if has_column_privilege('authenticated', 'public.crm_export_jobs', column_name, 'UPDATE')
      or (
        column_name not in ('module', 'columns', 'time_zone')
        and has_column_privilege('authenticated', 'public.crm_export_jobs', column_name, 'INSERT')
      ) then
      raise exception 'Authenticated can mutate restricted export-job column %.', column_name;
    end if;

    if has_column_privilege('anon', 'public.crm_export_jobs', column_name, 'SELECT')
      or has_column_privilege('anon', 'public.crm_export_jobs', column_name, 'INSERT')
      or has_column_privilege('anon', 'public.crm_export_jobs', column_name, 'UPDATE') then
      raise exception 'Anonymous can access restricted export-job column %.', column_name;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.crm_export_jobs', 'SELECT')
    or has_table_privilege('anon', 'public.crm_export_jobs', 'INSERT')
    or has_table_privilege('anon', 'public.crm_export_jobs', 'UPDATE')
    or has_table_privilege('anon', 'public.crm_export_jobs', 'DELETE') then
    raise exception 'Anonymous export-job access remains granted.';
  end if;
end;
$$;
