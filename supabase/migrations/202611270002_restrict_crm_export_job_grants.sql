begin;

revoke all privileges on table public.crm_export_jobs
  from public, anon, authenticated;
revoke all privileges (
  id,
  user_id,
  module,
  columns,
  time_zone,
  status,
  cursor_id,
  processed_rows,
  part_count,
  output_bytes,
  storage_path,
  error_message,
  claim_token,
  lease_expires_at,
  created_at,
  updated_at,
  completed_at
) on table public.crm_export_jobs
  from public, anon, authenticated;

grant select on table public.crm_export_jobs to authenticated;
grant insert (module, columns, time_zone)
  on table public.crm_export_jobs to authenticated;

do $$
declare
  column_name text;
begin
  if has_table_privilege('authenticated', 'public.crm_export_jobs', 'INSERT')
    or has_table_privilege('authenticated', 'public.crm_export_jobs', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crm_export_jobs', 'DELETE')
    or has_table_privilege('anon', 'public.crm_export_jobs', 'SELECT')
    or has_table_privilege('anon', 'public.crm_export_jobs', 'INSERT')
    or has_table_privilege('anon', 'public.crm_export_jobs', 'UPDATE')
    or has_table_privilege('anon', 'public.crm_export_jobs', 'DELETE') then
    raise exception 'Export-job table grants exceed the intended contract.';
  end if;

  if not has_table_privilege('authenticated', 'public.crm_export_jobs', 'SELECT')
    or not has_column_privilege('authenticated', 'public.crm_export_jobs', 'module', 'INSERT')
    or not has_column_privilege('authenticated', 'public.crm_export_jobs', 'columns', 'INSERT')
    or not has_column_privilege('authenticated', 'public.crm_export_jobs', 'time_zone', 'INSERT') then
    raise exception 'Authenticated export-job grants do not preserve job creation and reads.';
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
      )
      or has_column_privilege('anon', 'public.crm_export_jobs', column_name, 'SELECT')
      or has_column_privilege('anon', 'public.crm_export_jobs', column_name, 'INSERT')
      or has_column_privilege('anon', 'public.crm_export_jobs', column_name, 'UPDATE') then
      raise exception 'Unexpected export-job column grant remains for %.', column_name;
    end if;
  end loop;
end;
$$;

commit;
