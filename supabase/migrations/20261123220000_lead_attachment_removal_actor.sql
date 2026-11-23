begin;

create table public.lead_attachment_removal_intents (
  object_id uuid primary key,
  actor_id uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now()
);
alter table public.lead_attachment_removal_intents enable row level security;
revoke all on public.lead_attachment_removal_intents from public, anon, authenticated;

create function public.prepare_lead_attachment_removal(p_lead_id uuid, p_name text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  target_id uuid;
  caller uuid := auth.uid();
begin
  if caller is null or not coalesce(public.has_effective_permission(caller, 'leads.view'), false)
    or not coalesce(public.has_effective_permission(caller, 'leads.update'), false)
    or not exists (
      select 1 from public.leads l where l.id = p_lead_id
        and public.lead_is_live(l.id)
        and (l.sub_owner_id = caller or l.lead_owner_id in
          (select accessible_user_id from public.get_accessible_user_ids(caller)))
    ) then
    raise exception 'Attachment removal is unavailable' using errcode='42501';
  end if;
  if p_name is null or p_name = '' or strpos(p_name, '/') > 0 then
    raise exception 'Invalid attachment name' using errcode='22023';
  end if;
  select id into target_id from storage.objects
    where bucket_id='lead-attachments' and name=p_lead_id::text || '/' || p_name
    for update;
  if target_id is null then return; end if;
  insert into public.lead_attachment_removal_intents(object_id,actor_id)
  values(target_id,caller) on conflict do nothing;
  if not public.can_remove_prepared_lead_attachment(target_id) then
    raise exception 'Another user has started removing this attachment' using errcode='55000';
  end if;
end $$;

create function public.can_remove_prepared_lead_attachment(p_object_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.lead_attachment_removal_intents
    where object_id=p_object_id and actor_id=auth.uid())
$$;
revoke all on function public.prepare_lead_attachment_removal(uuid,text) from public, anon;
revoke all on function public.can_remove_prepared_lead_attachment(uuid) from public, anon;
grant execute on function public.prepare_lead_attachment_removal(uuid,text) to authenticated;
grant execute on function public.can_remove_prepared_lead_attachment(uuid) to authenticated;

create policy lead_attachment_requires_removal_intent on storage.objects as restrictive
for delete to authenticated using (
  bucket_id <> 'lead-attachments' or public.can_remove_prepared_lead_attachment(id)
);

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
    delete from public.lead_attachment_removal_intents
    where object_id = old.id returning actor_id into actor;
    actor := coalesce(actor, auth.uid());
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
