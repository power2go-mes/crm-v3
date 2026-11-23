begin;
-- Single-company equivalent of core.Department. Existing user labels are untouched.
create table public.departments (
 id uuid primary key default gen_random_uuid(),
 department_name varchar(50) not null check(length(btrim(department_name))>0),
 description text,
 created_by_id uuid references public.user_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create unique index departments_active_name on public.departments(department_name) where deleted_at is null;
alter table public.departments enable row level security;
insert into public.permissions(id,module,action,description) values
 ('departments.view','departments','view','View company departments'),
 ('departments.create','departments','create','Create company departments'),
 ('departments.update','departments','update','Edit company departments'),
 ('departments.delete','departments','delete','Move unreferenced departments to recovery'),
 ('departments.restore','departments','restore','Restore deleted departments')
on conflict(id) do nothing;
-- No canonical/custom role grants are installed. Role Manager remains authoritative.
create policy departments_read on public.departments for select to authenticated
 using(public.has_effective_permission(auth.uid(),'departments.view') and
 (deleted_at is null or public.has_effective_permission(auth.uid(),'departments.restore')));
revoke all on public.departments from public,anon,authenticated;
grant select on public.departments to authenticated;

create function public.save_department(p_id uuid,p_name text,p_description text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result_id uuid; begin
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),
 case when p_id is null then 'departments.create' else 'departments.update' end)
 or not public.has_effective_permission(auth.uid(),'departments.view') then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_name is null or length(btrim(p_name))=0 or length(btrim(p_name))>50 then
  raise exception 'Department Name must contain 1 to 50 characters' using errcode='23514';
 end if;
 if p_id is null then
  insert into public.departments(department_name,description,created_by_id)
  values(btrim(p_name),nullif(p_description,''),auth.uid()) returning id into result_id;
 else
  perform 1 from public.departments where id=p_id and deleted_at is null for update;
  if exists(select 1 from public.departments d join public.user_profiles u on u.department=d.department_name
    where d.id=p_id and d.department_name<>btrim(p_name)) then
   raise exception 'Department is referenced by users; remove those associations before renaming' using errcode='23503';
  end if;
  update public.departments set department_name=btrim(p_name),description=nullif(p_description,''),updated_at=now()
  where id=p_id and deleted_at is null returning id into result_id;
  if result_id is null then raise exception 'Department unavailable' using errcode='P0002'; end if;
 end if;
 return result_id;
end $$;

create function public.set_department_deleted(p_id uuid,p_deleted boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare current_name text; begin
 if p_deleted is null then raise exception 'Deletion action required' using errcode='23514'; end if;
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),'departments.view')
 or not public.has_effective_permission(auth.uid(),case when p_deleted then 'departments.delete' else 'departments.restore' end)
 then raise exception 'Permission denied' using errcode='42501'; end if;
 select department_name into current_name from public.departments
 where id=p_id and (deleted_at is not null)=(not p_deleted) for update;
 if not found then raise exception 'Department unavailable' using errcode='P0002'; end if;
 -- Legacy users store labels, not department IDs. Conservatively block referenced labels;
 -- do not invent FK associations or rewrite historical labels.
 if p_deleted and exists(select 1 from public.user_profiles where department=current_name)
 then raise exception 'Department is referenced by users; remove those associations first' using errcode='23503'; end if;
 update public.departments set deleted_at=case when p_deleted then now() else null end,updated_at=now() where id=p_id;
end $$;
revoke all on function public.save_department(uuid,text,text),public.set_department_deleted(uuid,boolean) from public,anon,authenticated;
grant execute on function public.save_department(uuid,text,text),public.set_department_deleted(uuid,boolean) to authenticated;
commit;
