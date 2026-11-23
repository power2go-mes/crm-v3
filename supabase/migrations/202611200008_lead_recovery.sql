begin;

create table public.lead_archives (
  lead_id uuid primary key references public.leads(id) on delete restrict,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.user_profiles(id) on delete set null
);
alter table public.lead_archives enable row level security;
revoke all on public.lead_archives from public, anon, authenticated;

create function public.lead_is_live(p_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select not exists(
    select 1 from public.lead_archives a join public.leads l on l.id=a.lead_id
    where a.lead_id=p_id and public.has_effective_permission(auth.uid(),'leads.view')
      and (l.sub_owner_id=auth.uid() or l.lead_owner_id in
        (select accessible_user_id from public.get_accessible_user_ids(auth.uid())))
  )
$$;
revoke all on function public.lead_is_live(uuid) from public, anon;
grant execute on function public.lead_is_live(uuid) to authenticated;
create policy lead_live_scope on public.leads as restrictive for all to authenticated
using (public.lead_is_live(id)) with check (public.lead_is_live(id));
create policy lead_recovery_requires_archive on public.leads as restrictive for delete to authenticated
using (false);

create function public.lead_archive_selected(p_ids uuid[]) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare affected integer;
begin
  if auth.uid() is null or not public.has_effective_permission(auth.uid(),'leads.delete')
     or not public.has_effective_permission(auth.uid(),'leads.view') then
    raise exception 'Lead deletion is unavailable.' using errcode='42501';
  end if;
  if coalesce(cardinality(p_ids),0) not between 1 and 500
     or cardinality(p_ids) <> (select count(distinct id) from unnest(p_ids) as chosen(id)) then
    raise exception 'Select between 1 and 500 distinct Leads.' using errcode='22023';
  end if;
  insert into public.lead_archives(lead_id,archived_by)
  select l.id,auth.uid() from public.leads l
  where l.id=any(p_ids)
    and l.lead_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
  order by l.id
  on conflict(lead_id) do nothing;
  get diagnostics affected=row_count;
  if affected <> cardinality(p_ids) then
    raise exception 'One or more selected Leads are unavailable for deletion.' using errcode='42501';
  end if;
  insert into public.lead_history(lead_id,field_name,old_value,new_value,actor_id)
  select id,'archived','false','true',auth.uid() from unnest(p_ids) as selected(id);
  return affected;
end $$;

create function public.lead_archived_list(p_offset integer default 0)
returns table(id uuid,title text,archived_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if auth.uid() is null or not public.has_effective_permission(auth.uid(),'leads.view')
     or not public.has_effective_permission(auth.uid(),'recycle_bin.view') then
    raise exception 'Lead recovery is unavailable.' using errcode='42501';
  end if;
  return query select l.id,
    case when exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key='title' and not public.crm_shared_field_access(d.id))
      then 'Lead' else l.title end,a.archived_at
  from public.lead_archives a join public.leads l on l.id=a.lead_id
  where l.lead_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
  order by a.archived_at desc,l.id limit 26 offset greatest(0,least(coalesce(p_offset,0),100000));
end $$;

create function public.lead_restore(p_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if auth.uid() is null or not public.has_effective_permission(auth.uid(),'leads.view')
     or not public.has_effective_permission(auth.uid(),'recycle_bin.restore') then
    raise exception 'Lead recovery is unavailable.' using errcode='42501';
  end if;
  delete from public.lead_archives a using public.leads l
  where a.lead_id=p_id and l.id=a.lead_id
    and l.lead_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()));
  if not found then raise exception 'Lead is unavailable for recovery.' using errcode='42501'; end if;
  insert into public.lead_history(lead_id,field_name,old_value,new_value,actor_id)
  values(p_id,'archived','true','false',auth.uid());
end $$;

revoke all on function public.lead_archive_selected(uuid[]), public.lead_archived_list(integer), public.lead_restore(uuid) from public, anon;
grant execute on function public.lead_archive_selected(uuid[]), public.lead_archived_list(integer), public.lead_restore(uuid) to authenticated;
commit;
