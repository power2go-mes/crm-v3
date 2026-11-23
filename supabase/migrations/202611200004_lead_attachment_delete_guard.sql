begin;
create function public.prevent_lead_delete_with_attachments()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id='lead-attachments' and name like old.id::text || '/%'
  ) then
    raise exception 'Remove this Lead''s attachments before deleting it.' using errcode='23503';
  end if;
  return old;
end $$;
revoke all on function public.prevent_lead_delete_with_attachments() from public, anon, authenticated;
create trigger prevent_lead_delete_with_attachments
before delete on public.leads
for each row execute function public.prevent_lead_delete_with_attachments();
commit;
