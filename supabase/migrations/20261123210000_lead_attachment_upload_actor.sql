begin;

create or replace function public.log_lead_attachment_event() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare
  object_path text;
  target text;
  action text;
  actor uuid := auth.uid();
begin
  if tg_op='DELETE' then
    if old.bucket_id <> 'lead-attachments' then return null; end if;
    object_path := old.name;
    action := 'Removed';
  else
    if new.bucket_id <> 'lead-attachments' then return null; end if;
    object_path := new.name;
    action := 'Uploaded';
    -- Storage stamps owner_id from the authenticated upload session.
    -- On removal owner_id is the original uploader, so it cannot identify the remover.
    if actor is null and new.owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select id into actor from public.user_profiles where id=new.owner_id::uuid;
    end if;
  end if;
  target := split_part(object_path,'/',1);
  if target ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    insert into public.lead_history(lead_id,field_name,new_value,actor_id)
    select id,'attachment',action,actor from public.leads where id=target::uuid;
  end if;
  return null;
end $$;

commit;
