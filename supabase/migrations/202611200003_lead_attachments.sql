begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('lead-attachments', 'lead-attachments', false, 10485760);

-- Use the Lead row's existing RLS scope. Compare the canonical ID as text so
-- malformed object names cannot cause casts or bypass the path checks.
create policy lead_attachment_read on storage.objects for select to authenticated
using (
  bucket_id = 'lead-attachments'
  and cardinality(storage.foldername(name)) = 1
  and exists (select 1 from public.leads l where l.id::text = (storage.foldername(name))[1])
);

create policy lead_attachment_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'lead-attachments'
  and cardinality(storage.foldername(name)) = 1
  and public.has_effective_permission(auth.uid(), 'leads.update')
  and exists (select 1 from public.leads l where l.id::text = (storage.foldername(name))[1])
);

create policy lead_attachment_remove on storage.objects for delete to authenticated
using (
  bucket_id = 'lead-attachments'
  and cardinality(storage.foldername(name)) = 1
  and public.has_effective_permission(auth.uid(), 'leads.update')
  and exists (select 1 from public.leads l where l.id::text = (storage.foldername(name))[1])
);

commit;
