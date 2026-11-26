begin;

create table public.crm_export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.user_profiles(id) on delete cascade,
  module text not null check (module = 'leads'),
  columns jsonb not null check (jsonb_typeof(columns) = 'array'),
  time_zone text not null default 'UTC' check (length(time_zone) <= 100),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'assembling', 'completed', 'failed')),
  cursor_id uuid,
  processed_rows integer not null default 0 check (processed_rows >= 0),
  part_count integer not null default 0 check (part_count >= 0),
  output_bytes bigint not null default 0 check (output_bytes >= 0),
  storage_path text,
  error_message text,
  claim_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index crm_export_jobs_owner_created
  on public.crm_export_jobs (user_id, created_at desc, id);

create unique index crm_export_jobs_one_active_per_user
  on public.crm_export_jobs (user_id)
  where status in ('queued', 'processing');

alter table public.crm_export_jobs enable row level security;

create policy crm_export_jobs_select_own
  on public.crm_export_jobs for select to authenticated
  using (
    user_id = auth.uid()
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
  );

create policy crm_export_jobs_insert_own
  on public.crm_export_jobs for insert to authenticated
  with check (
    user_id = auth.uid()
    and module = 'leads'
    and status = 'queued'
    and cursor_id is null
    and processed_rows = 0
    and part_count = 0
    and output_bytes = 0
    and storage_path is null
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
  );

create policy crm_export_jobs_update_own
  on public.crm_export_jobs for update to authenticated
  using (
    user_id = auth.uid()
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
  )
  with check (
    user_id = auth.uid()
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
  );

revoke all on public.crm_export_jobs from public, anon;
grant select on public.crm_export_jobs to authenticated;
grant insert (module, columns, time_zone) on public.crm_export_jobs to authenticated;

create function public.claim_crm_export_job(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.crm_export_jobs;
begin
  if auth.uid() is null
    or not coalesce(public.has_effective_permission(auth.uid(), 'exports.view'), false)
    or not coalesce(public.has_effective_permission(auth.uid(), 'leads.view'), false)
    or not coalesce(public.has_effective_permission(auth.uid(), 'leads.export'), false) then
    raise exception 'Permission denied.';
  end if;

  update public.crm_export_jobs j
  set status = 'processing',
      claim_token = gen_random_uuid(),
      lease_expires_at = now() + interval '2 minutes',
      updated_at = now()
  where j.id = p_job
    and j.user_id = auth.uid()
    and j.status in ('queued', 'processing')
    and (j.lease_expires_at is null or j.lease_expires_at <= now())
  returning j.* into claimed;

  if not found then return null; end if;
  return jsonb_build_object(
    'id', claimed.id,
    'claim_token', claimed.claim_token,
    'cursor_id', claimed.cursor_id,
    'part_count', claimed.part_count,
    'processed_rows', claimed.processed_rows,
    'output_bytes', claimed.output_bytes,
    'columns', claimed.columns,
    'time_zone', claimed.time_zone
  );
end;
$$;

create function public.complete_crm_export_batch(
  p_job uuid,
  p_claim_token uuid,
  p_cursor_id uuid,
  p_batch_rows integer,
  p_part_bytes bigint,
  p_finished boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if auth.uid() is null
    or not coalesce(public.has_effective_permission(auth.uid(), 'exports.view'), false)
    or not coalesce(public.has_effective_permission(auth.uid(), 'leads.view'), false)
    or not coalesce(public.has_effective_permission(auth.uid(), 'leads.export'), false) then
    raise exception 'Permission denied.';
  end if;
  if p_batch_rows < 0 or p_batch_rows > 250 or p_part_bytes < 0 or p_part_bytes > 8388608 then
    raise exception 'Invalid export batch.';
  end if;

  update public.crm_export_jobs j
  set cursor_id = p_cursor_id,
      processed_rows = j.processed_rows + p_batch_rows,
      part_count = j.part_count + 1,
      output_bytes = j.output_bytes + p_part_bytes,
      storage_path = auth.uid()::text || '/' || j.id::text || '/parts',
      status = case when p_finished then 'completed' else 'queued' end,
      claim_token = null,
      lease_expires_at = null,
      error_message = null,
      updated_at = now(),
      completed_at = case when p_finished then now() else null end
  where j.id = p_job
    and j.user_id = auth.uid()
    and j.status = 'processing'
    and j.claim_token = p_claim_token
    and j.lease_expires_at > now()
    and j.processed_rows + p_batch_rows <= 100000
    and j.output_bytes + p_part_bytes <= 52428800
    and j.part_count < 401;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create function public.release_crm_export_job(
  p_job uuid,
  p_claim_token uuid,
  p_error text,
  p_terminal boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.crm_export_jobs j
  set status = case when p_terminal then 'failed' else 'queued' end,
      claim_token = null,
      lease_expires_at = null,
      error_message = left(p_error, 300),
      updated_at = now()
  where j.id = p_job
    and j.user_id = auth.uid()
    and j.status = 'processing'
    and j.claim_token = p_claim_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_crm_export_job(uuid) from public, anon;
revoke all on function public.complete_crm_export_batch(uuid, uuid, uuid, integer, bigint, boolean) from public, anon;
revoke all on function public.release_crm_export_job(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.claim_crm_export_job(uuid) to authenticated;
grant execute on function public.complete_crm_export_batch(uuid, uuid, uuid, integer, bigint, boolean) to authenticated;
grant execute on function public.release_crm_export_job(uuid, uuid, text, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-export-jobs', 'crm-export-jobs', false, 52428800, array['text/csv'])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy crm_export_files_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'crm-export-jobs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
    and exists (
      select 1 from public.crm_export_jobs j
      where j.id::text = (storage.foldername(name))[2]
        and j.user_id = auth.uid()
        and j.status in ('processing', 'completed')
    )
  );

create policy crm_export_files_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'crm-export-jobs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and cardinality(storage.foldername(name)) = 3
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}/parts/[0-9]{6}\.csv$')
    and exists (
      select 1 from public.crm_export_jobs j
      where j.id::text = (storage.foldername(name))[2]
        and j.user_id = auth.uid()
        and j.status = 'processing'
    )
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
  );

create policy crm_export_files_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'crm-export-jobs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and cardinality(storage.foldername(name)) = 3
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}/parts/[0-9]{6}\.csv$')
    and exists (
      select 1 from public.crm_export_jobs j
      where j.id::text = (storage.foldername(name))[2]
        and j.user_id = auth.uid()
        and j.status = 'processing'
    )
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
  )
  with check (
    bucket_id = 'crm-export-jobs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and cardinality(storage.foldername(name)) = 3
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}/parts/[0-9]{6}\.csv$')
    and exists (
      select 1 from public.crm_export_jobs j
      where j.id::text = (storage.foldername(name))[2]
        and j.user_id = auth.uid()
        and j.status = 'processing'
    )
    and public.has_effective_permission(auth.uid(), 'exports.view')
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and public.has_effective_permission(auth.uid(), 'leads.export')
  );

create policy crm_export_files_delete_own
  on storage.objects for delete to authenticated
  using (bucket_id = 'crm-export-jobs' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
