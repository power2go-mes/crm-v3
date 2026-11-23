begin;

alter table public.lead_attachment_removal_intents
  add column if not exists admin_actor_id uuid references public.user_profiles(id),
  add column if not exists confirmed_at timestamptz;

create or replace function public.confirm_lead_attachment_removal_handoff(
  p_lead_id uuid,
  p_name text,
  p_confirmed boolean
)
returns table(object_id uuid, original_actor_id uuid, admin_actor_id uuid)
language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_caller uuid := auth.uid();
  v_target_id uuid;
  v_orig_actor uuid;
  v_lead public.leads%rowtype;
begin
  if v_caller is null
    or not coalesce(public.has_effective_permission(v_caller, 'settings.update'), false)
    or not coalesce(public.has_effective_permission(v_caller, 'leads.update'), false) then
    raise exception 'Administrative attachment handoff is unavailable' using errcode='42501';
  end if;

  if p_confirmed is distinct from true then
    raise exception 'Confirm administrative handoff before continuing' using errcode='22023';
  end if;

  if p_name is null or p_name = '' or strpos(p_name, '/') > 0 then
    raise exception 'Invalid attachment name' using errcode='22023';
  end if;

  select * into v_lead from public.leads where id = p_lead_id and public.lead_is_live(id);
  if not found then
    raise exception 'Lead record is unavailable' using errcode='42501';
  end if;

  select id into v_target_id from storage.objects
    where bucket_id = 'lead-attachments' and name = p_lead_id::text || '/' || p_name
    for update;

  if v_target_id is null then
    raise exception 'Attachment object not found' using errcode='44002';
  end if;

  select actor_id into v_orig_actor from public.lead_attachment_removal_intents
    where lead_attachment_removal_intents.object_id = v_target_id for update;

  if not found then
    insert into public.lead_attachment_removal_intents(object_id, actor_id, admin_actor_id, confirmed_at)
    values(v_target_id, v_caller, v_caller, now())
    returning lead_attachment_removal_intents.actor_id, lead_attachment_removal_intents.admin_actor_id into v_orig_actor, v_caller;
  else
    update public.lead_attachment_removal_intents
    set admin_actor_id = v_caller,
        confirmed_at = now()
    where lead_attachment_removal_intents.object_id = v_target_id;
  end if;

  return query select v_target_id, v_orig_actor, v_caller;
end $$;

create or replace function public.can_remove_prepared_lead_attachment(p_object_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.lead_attachment_removal_intents
    where object_id=p_object_id and (actor_id=auth.uid() or admin_actor_id=auth.uid()))
$$;

create or replace function public.log_lead_attachment_event() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare
  object_path text;
  target text;
  action text;
  v_actor uuid;
  v_orig_actor uuid;
  v_admin_actor uuid;
begin
  if tg_op='DELETE' then
    if old.bucket_id <> 'lead-attachments' then return null; end if;
    object_path := old.name;
    action := 'Removed';

    delete from public.lead_attachment_removal_intents
    where object_id = old.id
    returning actor_id, admin_actor_id into v_orig_actor, v_admin_actor;

    v_actor := coalesce(v_admin_actor, v_orig_actor, auth.uid());
  else
    if new.bucket_id <> 'lead-attachments' then return null; end if;
    object_path := new.name;
    action := 'Uploaded';
    if v_actor is null and new.owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select id into v_actor from public.user_profiles where id=new.owner_id::uuid;
    end if;
  end if;

  target := split_part(object_path,'/',1);
  if target ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if v_admin_actor is not null and v_orig_actor is not null and v_admin_actor <> v_orig_actor then
      insert into public.lead_history(lead_id, field_name, old_value, new_value, actor_id)
      select id, 'attachment', 'Original intent: ' || v_orig_actor::text, action, v_admin_actor
      from public.leads where id = target::uuid;
    else
      insert into public.lead_history(lead_id, field_name, new_value, actor_id)
      select id, 'attachment', action, v_actor
      from public.leads where id = target::uuid;
    end if;
  end if;
  return null;
end $$;

revoke all on function public.confirm_lead_attachment_removal_handoff(uuid,text,boolean) from public, anon;
grant execute on function public.confirm_lead_attachment_removal_handoff(uuid,text,boolean) to authenticated;

commit;
