begin;

create function public.log_lead_note_event() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare
  target uuid;
  action text;
begin
  if tg_op='UPDATE' and old.title is not distinct from new.title and old.body is not distinct from new.body then
    return new;
  end if;
  target := case when tg_op='DELETE' then old.lead_id else new.lead_id end;
  action := case tg_op when 'INSERT' then 'Created' when 'UPDATE' then 'Edited' else 'Removed' end;
  insert into public.lead_history(lead_id,field_name,new_value,actor_id)
  select target,'note',action,auth.uid() where exists(select 1 from public.leads where id=target);
  return null;
end $$;
revoke all on function public.log_lead_note_event() from public,anon,authenticated;
create trigger lead_notes_history after insert or update or delete on public.lead_notes
for each row execute function public.log_lead_note_event();

create function public.log_lead_attachment_event() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare
  object_path text;
  target text;
  action text;
begin
  if tg_op='DELETE' then
    if old.bucket_id <> 'lead-attachments' then return null; end if;
    object_path := old.name;
    action := 'Removed';
  else
    if new.bucket_id <> 'lead-attachments' then return null; end if;
    object_path := new.name;
    action := 'Uploaded';
  end if;
  target := split_part(object_path,'/',1);
  if target ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    insert into public.lead_history(lead_id,field_name,new_value,actor_id)
    select id,'attachment',action,auth.uid() from public.leads where id=target::uuid;
  end if;
  return null;
end $$;
revoke all on function public.log_lead_attachment_event() from public,anon,authenticated;
create trigger lead_attachment_history after insert or delete on storage.objects
for each row execute function public.log_lead_attachment_event();
commit;
