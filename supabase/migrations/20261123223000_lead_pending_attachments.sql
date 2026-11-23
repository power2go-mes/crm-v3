begin;

create table public.lead_pending_attachments (
  submission_id uuid primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  object_name text not null,
  owner_id uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cleanup_claimed_at timestamptz,
  cleanup_actor_id uuid,
  cleanup_attempts integer not null default 0,
  removed_at timestamptz,
  unique (lead_id, object_name)
);
alter table public.lead_pending_attachments enable row level security;
revoke all on public.lead_pending_attachments from public, anon, authenticated;

create function public.begin_lead_pending_attachment(p_submission_id uuid,p_lead_id uuid,p_name text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare caller uuid := auth.uid();
begin
  if caller is null or not coalesce(public.has_effective_permission(caller,'leads.view'),false)
    or not coalesce(public.has_effective_permission(caller,'leads.update'),false)
    or not exists(select 1 from public.leads l where l.id=p_lead_id and public.lead_is_live(l.id)
      and (l.sub_owner_id=caller or l.lead_owner_id in
        (select accessible_user_id from public.get_accessible_user_ids(caller)))) then
    raise exception 'Lead attachment is unavailable' using errcode='42501';
  end if;
  if p_submission_id is null or p_name is null or strpos(p_name,'/')<>0
    or left(p_name,37)<>p_submission_id::text || '_' then
    raise exception 'Invalid submission attachment name' using errcode='22023';
  end if;
  if exists(select 1 from storage.objects where bucket_id='lead-attachments'
    and name=p_lead_id::text || '/' || p_name)
    and not exists(select 1 from public.lead_pending_attachments where submission_id=p_submission_id) then
    raise exception 'Attachment already exists' using errcode='23505';
  end if;
  insert into public.lead_pending_attachments(submission_id,lead_id,object_name,owner_id)
  values(p_submission_id,p_lead_id,p_name,caller) on conflict(submission_id) do nothing;
  if not exists(select 1 from public.lead_pending_attachments where submission_id=p_submission_id
    and lead_id=p_lead_id and object_name=p_name and owner_id=caller and cleanup_claimed_at is null) then
    raise exception 'Submission attachment is unavailable' using errcode='42501';
  end if;
end $$;

create function public.complete_lead_pending_attachment()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare pending public.lead_pending_attachments%rowtype;
begin
  select * into pending from public.lead_pending_attachments
  where submission_id=new.id for update;
  if not found then return new; end if;
  if pending.lead_id<>new.lead_id or pending.owner_id is distinct from auth.uid()
    or pending.cleanup_claimed_at is not null or pending.removed_at is not null
    or not exists(select 1 from storage.objects o where o.bucket_id='lead-attachments'
      and o.name=pending.lead_id::text || '/' || pending.object_name
      and o.owner_id=pending.owner_id::text) then
    raise exception 'Submission file is unavailable' using errcode='55000';
  end if;
  update public.lead_pending_attachments set completed_at=now() where submission_id=new.id;
  return new;
end $$;
create trigger lead_note_complete_pending_attachment before insert on public.lead_notes
for each row execute function public.complete_lead_pending_attachment();

create function public.claim_expired_lead_pending_attachment(p_submission_id uuid)
returns table(lead_id uuid, object_name text)
language plpgsql security definer set search_path=pg_catalog as $$
declare pending public.lead_pending_attachments%rowtype;
begin
  select * into pending from public.lead_pending_attachments
    where submission_id=p_submission_id for update;
  if not found or pending.completed_at is not null or pending.removed_at is not null
    or pending.created_at>now()-interval '24 hours'
    or exists(select 1 from public.lead_notes n where n.id=p_submission_id)
    or not exists(select 1 from storage.objects o where o.bucket_id='lead-attachments'
      and o.name=pending.lead_id::text || '/' || pending.object_name
      and o.owner_id=pending.owner_id::text) then
    raise exception 'Expired pending attachment is unavailable' using errcode='55000';
  end if;
  perform public.prepare_lead_attachment_removal(pending.lead_id,pending.object_name);
  update public.lead_pending_attachments p set cleanup_claimed_at=coalesce(p.cleanup_claimed_at,now()),
    cleanup_actor_id=auth.uid(),cleanup_attempts=p.cleanup_attempts+1
  where p.submission_id=p_submission_id;
  return query select pending.lead_id,pending.object_name;
end $$;

create function public.mark_lead_pending_attachment_removed()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.lead_pending_attachments p set removed_at=now()
  where old.bucket_id='lead-attachments' and old.name=p.lead_id::text || '/' || p.object_name
    and old.owner_id=p.owner_id::text;
  return null;
end $$;
create trigger lead_pending_attachment_removed after delete on storage.objects
for each row when (old.bucket_id='lead-attachments') execute function public.mark_lead_pending_attachment_removed();

revoke all on function public.begin_lead_pending_attachment(uuid,uuid,text),
  public.claim_expired_lead_pending_attachment(uuid),
  public.complete_lead_pending_attachment(),public.mark_lead_pending_attachment_removed()
from public,anon,authenticated;
grant execute on function public.begin_lead_pending_attachment(uuid,uuid,text),
  public.claim_expired_lead_pending_attachment(uuid) to authenticated;

commit;
