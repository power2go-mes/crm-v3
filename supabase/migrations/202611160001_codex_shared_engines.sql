-- Codex-owned, additive, UNAPPLIED. No Leads tables, policies, roles or bindings changed.
-- Requires 00001-00005. Binding/trigger attachment needs exclusive DB ownership.
begin;

-- A trusted installer supplies an INVOKER function (text record_id, text action)
-- returning boolean. It MUST check the real entity's RLS and action-specific scope.
-- No module is registered by this migration: absent adapters fail closed.
create table public.crm_shared_modules (
  module text primary key check (module ~ '^[a-z][a-z0-9_]{0,62}$'),
  access_function regprocedure not null
);
revoke all on public.crm_shared_modules from public, anon, authenticated;
grant select on public.crm_shared_modules to authenticated;
alter table public.crm_shared_modules enable row level security;
create policy crm_modules_read on public.crm_shared_modules for select to authenticated
  using (public.is_active_employee());

create function public.crm_shared_record_access(m text, rid text, action text)
returns boolean language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare fn_schema text; fn_name text; permitted boolean;
begin
  if auth.uid() is null or not public.is_active_employee()
    or action not in ('view','update','export')
    or not public.has_effective_permission(auth.uid(), m || '.' || action) then
    return false;
  end if;
  select n.nspname, p.proname into fn_schema, fn_name
  from public.crm_shared_modules b
  join pg_proc p on p.oid = b.access_function
  join pg_namespace n on n.oid = p.pronamespace
  where b.module = m and p.prorettype = 'boolean'::regtype
    and p.proargtypes = '25 25'::oidvector and not p.prosecdef;
  if fn_name is null then return false; end if;
  execute format('select %I.%I($1,$2)', fn_schema, fn_name) into permitted using rid, action;
  return coalesce(permitted, false);
end $$;

create table public.crm_field_definitions (
  id uuid primary key default gen_random_uuid(),
  module text not null references public.crm_shared_modules(module),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  label text not null check (length(btrim(label)) between 1 and 255 and label !~ '[<>]'),
  type text not null check (type in ('small_text','large_text','number','choice','single_choice','date','datetime')),
  required boolean not null default false,
  relaxable boolean not null default true,
  is_custom boolean not null default true,
  sensitive boolean not null default false,
  archived boolean not null default false,
  position integer not null default 0 check (position >= 0),
  choices jsonb not null default '[]' check (jsonb_typeof(choices) = 'array'),
  unique(module, key), unique(id, module)
);
create table public.crm_field_rules (
  definition_id uuid not null references public.crm_field_definitions(id) on delete cascade,
  role_id text not null references public.roles(id),
  visible boolean not null default true,
  editable boolean not null default true,
  primary key(definition_id, role_id)
);
create function public.crm_shared_field_access(fid uuid, writing boolean default false)
returns boolean language sql stable security invoker set search_path = pg_catalog, public as $$
  select auth.uid() is not null and public.is_active_employee()
    and exists (select 1 from public.crm_field_definitions d where d.id = fid and not d.archived
      and public.has_effective_permission(auth.uid(), d.module || case when writing then '.update' else '.view' end))
    and not exists (
      select 1 from public.crm_field_rules fr join public.user_roles ur on ur.role_id=fr.role_id
      where fr.definition_id=fid and ur.user_id=auth.uid()
        and (not fr.visible or (writing and not fr.editable))
    )
$$;
alter table public.crm_field_definitions enable row level security;
alter table public.crm_field_rules enable row level security;
-- Metadata is not a secret; values are separately filtered. Avoid recursive field-rule policies.
create policy crm_definitions_read on public.crm_field_definitions for select to authenticated
  using (public.is_active_employee() and public.has_effective_permission(auth.uid(), module || '.view'));
create policy crm_definitions_manage on public.crm_field_definitions for all to authenticated
  using (public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'))
  with check (public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'));
create policy crm_rules_read on public.crm_field_rules for select to authenticated
  using (public.is_active_employee());
create policy crm_rules_manage on public.crm_field_rules for all to authenticated
  using (public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'))
  with check (public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'));
grant select,insert,update,delete on public.crm_field_definitions, public.crm_field_rules to authenticated;

create function public.crm_shared_validate_definition() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if jsonb_array_length(new.choices)>200
    or exists(select 1 from jsonb_array_elements(new.choices) e where jsonb_typeof(e)<>'string' or length(btrim(e #>> '{}')) not between 1 and 255)
    or (select count(*) <> count(distinct e) from jsonb_array_elements(new.choices) e)
    or (new.type in ('choice','single_choice') and jsonb_array_length(new.choices)=0) then
    raise exception 'Invalid field choices' using errcode='22023';
  end if;
  -- Existing values must never become invalid silently after a type/choice change.
  if tg_op='UPDATE' and (old.type<>new.type or old.choices<>new.choices)
    and exists(select 1 from public.crm_custom_values v where v.definition_id=old.id) then
    raise exception 'Migrate existing values before changing field type/choices';
  end if;
  return new;
end $$;

create table public.crm_custom_values (
  module text not null,
  record_id text not null check (length(record_id) between 1 and 200),
  definition_id uuid not null,
  value jsonb not null,
  primary key(module,record_id,definition_id),
  foreign key(definition_id,module) references public.crm_field_definitions(id,module) on delete cascade
);
create trigger crm_definition_validation before insert or update on public.crm_field_definitions
  for each row execute function public.crm_shared_validate_definition();
revoke all on function public.crm_shared_validate_definition() from public,anon,authenticated;
create function public.crm_shared_validate_value() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare d public.crm_field_definitions; v jsonb; txt text; effective_required boolean;
begin
  if tg_op='UPDATE' and (old.module<>new.module or old.record_id<>new.record_id or old.definition_id<>new.definition_id) then
    raise exception 'Custom value identity is immutable';
  end if;
  select * into strict d from public.crm_field_definitions where id=new.definition_id and module=new.module;
  if not d.is_custom or d.archived then raise exception 'Not an active custom field'; end if;
  select coalesce((select r.required from public.crm_field_requirements r where r.definition_id=d.id), d.required)
    into effective_required;
  v=new.value; txt=v #>> '{}';
  if v='null'::jsonb or v='""'::jsonb or v='[]'::jsonb then
    if effective_required then raise exception 'Required custom field: %',d.key; end if;
    return new;
  end if;
  case d.type
    when 'small_text','large_text' then
      if jsonb_typeof(v)<>'string' or length(txt)>(case when d.type='small_text' then 255 else 32000 end) then
        raise exception 'Invalid text';
      end if;
    when 'number' then
      if jsonb_typeof(v) not in ('string','number') or txt !~ '^-?[0-9]{1,16}(\.[0-9]{1,4})?$' then
        raise exception 'Invalid decimal(20,4)';
      end if;
    when 'choice' then
      if jsonb_typeof(v)<>'array' then raise exception 'Expected choice array'; end if;
      if jsonb_array_length(v)>200
        or exists(select 1 from jsonb_array_elements(v) e where not d.choices @> jsonb_build_array(e))
        or (select count(*)<>count(distinct e) from jsonb_array_elements(v) e) then
        raise exception 'Invalid multiple choice';
      end if;
    when 'single_choice' then
      if jsonb_typeof(v)<>'string' or not d.choices @> jsonb_build_array(v) then raise exception 'Invalid single choice'; end if;
    when 'date' then
      if jsonb_typeof(v)<>'string' or txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (txt::date)::text<>txt then
        raise exception 'Invalid date';
      end if;
    when 'datetime' then
      if jsonb_typeof(v)<>'string' or txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*(Z|[+-][0-9]{2}:[0-9]{2})$' then
        raise exception 'Expected datetime with offset';
      end if;
      perform txt::timestamptz;
  end case;
  return new;
end $$;
create trigger crm_value_validation before insert or update on public.crm_custom_values
  for each row execute function public.crm_shared_validate_value();
alter table public.crm_custom_values enable row level security;
create policy crm_values_read on public.crm_custom_values for select to authenticated
  using(public.crm_shared_record_access(module,record_id,'view') and public.crm_shared_field_access(definition_id));
create policy crm_values_insert on public.crm_custom_values for insert to authenticated
  with check(public.crm_shared_record_access(module,record_id,'update') and public.crm_shared_field_access(definition_id,true));
create policy crm_values_update on public.crm_custom_values for update to authenticated
  using(public.crm_shared_record_access(module,record_id,'update') and public.crm_shared_field_access(definition_id,true))
  with check(public.crm_shared_record_access(module,record_id,'update') and public.crm_shared_field_access(definition_id,true));
-- Clearing values uses validated null/empty writes; no direct DELETE bypass for requiredness.
grant select,insert,update on public.crm_custom_values to authenticated;
revoke delete on public.crm_custom_values from authenticated;

create table public.crm_form_layouts (
  module text primary key references public.crm_shared_modules(module),
  fields jsonb not null check(jsonb_typeof(fields)='array' and jsonb_array_length(fields)<=200)
);
create table public.crm_field_requirements (
  definition_id uuid primary key references public.crm_field_definitions(id) on delete cascade,
  required boolean not null
);
-- Company-wide configuration, consistent with v2. Selected layout is a user preference.
alter table public.crm_form_layouts enable row level security;
alter table public.crm_field_requirements enable row level security;
create policy crm_layout_read on public.crm_form_layouts for select to authenticated using(public.is_active_employee());
create policy crm_layout_manage on public.crm_form_layouts for all to authenticated
  using(public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'))
  with check(public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'));
create policy crm_requirements_read on public.crm_field_requirements for select to authenticated using(public.is_active_employee());
create policy crm_requirements_manage on public.crm_field_requirements for all to authenticated
  using(public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'))
  with check(public.is_active_employee() and public.has_effective_permission(auth.uid(),'settings.update'));
grant select,insert,update,delete on public.crm_form_layouts,public.crm_field_requirements to authenticated;
create function public.crm_shared_validate_requirement() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
  if not new.required and exists(select 1 from public.crm_field_definitions d
    where d.id=new.definition_id and d.required and not d.relaxable) then
    raise exception 'Field cannot be made optional';
  end if;
  return new;
end $$;
create trigger crm_requirement_validation before insert or update on public.crm_field_requirements
  for each row execute function public.crm_shared_validate_requirement();

create table public.crm_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.user_profiles(id) on delete cascade,
  module text not null references public.crm_shared_modules(module),
  name text not null check(length(btrim(name)) between 1 and 100),
  is_public boolean not null default false,
  state jsonb not null check(jsonb_typeof(state)='object'),
  unique(user_id,module,name)
);
create table public.crm_view_preferences (
  user_id uuid not null default auth.uid() references public.user_profiles(id) on delete cascade,
  module text not null references public.crm_shared_modules(module),
  context text not null default '' check(length(context)<=200),
  url_name text not null default '' check(length(url_name)<=200),
  state jsonb not null check(jsonb_typeof(state)='object'),
  primary key(user_id,module,context,url_name)
);
create table public.crm_recent_records (
  user_id uuid not null default auth.uid() references public.user_profiles(id) on delete cascade,
  module text not null references public.crm_shared_modules(module),
  record_id text not null,
  viewed_at timestamptz not null default now(),
  primary key(user_id,module,record_id)
);
alter table public.crm_saved_views enable row level security;
alter table public.crm_view_preferences enable row level security;
alter table public.crm_recent_records enable row level security;
create policy crm_saved_read on public.crm_saved_views for select to authenticated
  using(public.is_active_employee() and (user_id=auth.uid() or is_public)
    and public.has_effective_permission(auth.uid(),module||'.view'));
create policy crm_saved_write on public.crm_saved_views for all to authenticated
  using(public.is_active_employee() and user_id=auth.uid())
  with check(public.is_active_employee() and user_id=auth.uid()
    and public.has_effective_permission(auth.uid(),module||'.view'));
create policy crm_preferences_owner on public.crm_view_preferences for all to authenticated
  using(public.is_active_employee() and user_id=auth.uid())
  with check(public.is_active_employee() and user_id=auth.uid()
    and public.has_effective_permission(auth.uid(),module||'.view'));
create policy crm_recent_read on public.crm_recent_records for select to authenticated
  using(user_id=auth.uid() and public.crm_shared_record_access(module,record_id,'view'));
create policy crm_recent_insert on public.crm_recent_records for insert to authenticated
  with check(user_id=auth.uid() and public.crm_shared_record_access(module,record_id,'view'));
create policy crm_recent_update on public.crm_recent_records for update to authenticated
  using(user_id=auth.uid() and public.crm_shared_record_access(module,record_id,'view'))
  with check(user_id=auth.uid() and public.crm_shared_record_access(module,record_id,'view'));
grant select,insert,update,delete on public.crm_saved_views,public.crm_view_preferences to authenticated;
grant select,insert,update on public.crm_recent_records to authenticated;

create table public.crm_history_events (
  id uuid primary key default gen_random_uuid(),
  module text not null references public.crm_shared_modules(module),
  record_id text not null,
  transaction_id bigint not null default txid_current(),
  action text not null check(action in ('create','update','delete')),
  actor_id uuid default auth.uid(),
  occurred_at timestamptz not null default transaction_timestamp(),
  unique(module,record_id,transaction_id)
);
create index crm_history_record on public.crm_history_events(module,record_id,occurred_at desc,id);
create table public.crm_history_changes (
  event_id uuid not null references public.crm_history_events(id) on delete cascade,
  definition_id uuid not null references public.crm_field_definitions(id),
  old_value jsonb,
  new_value jsonb,
  primary key(event_id,definition_id)
);
alter table public.crm_history_events enable row level security;
alter table public.crm_history_changes enable row level security;
create policy crm_history_read on public.crm_history_events for select to authenticated
  using(public.crm_shared_record_access(module,record_id,'view'));
create policy crm_changes_read on public.crm_history_changes for select to authenticated
  using(public.crm_shared_field_access(definition_id)
    and exists(select 1 from public.crm_field_definitions d where d.id=definition_id and not d.sensitive)
    and exists(select 1 from public.crm_history_events e where e.id=event_id
      and public.crm_shared_record_access(e.module,e.record_id,'view')));
revoke all on public.crm_history_events,public.crm_history_changes from public,anon,authenticated;
grant select on public.crm_history_events,public.crm_history_changes to authenticated;

-- Installer attaches this trigger to a module table, passing its registered module.
-- Registered fields only; sensitive values are NEVER stored. Actor comes from JWT.
create function public.crm_shared_capture_history() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare m text; rid text; before_row jsonb; after_row jsonb; eid uuid; d record;
begin
  if tg_nargs<>1 then raise exception 'Expected registered module'; end if;
  m=tg_argv[0];
  if not exists(select 1 from public.crm_shared_modules where module=m) then
    raise exception 'Module not registered';
  end if;
  before_row=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  after_row=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  rid=coalesce(after_row->>'id',before_row->>'id');
  if rid is null then raise exception 'History adapter requires id'; end if;
  if tg_op='UPDATE' and not exists(select 1 from public.crm_field_definitions f
    where f.module=m and not f.sensitive and before_row->f.key is distinct from after_row->f.key) then
    return null;
  end if;
  insert into public.crm_history_events(module,record_id,action)
    values(m,rid,lower(case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end))
    on conflict(module,record_id,transaction_id) do update set
      action=case when excluded.action='delete' then 'delete' else crm_history_events.action end
    returning id into eid;
  for d in select id,key from public.crm_field_definitions where module=m and not sensitive loop
    if before_row->d.key is distinct from after_row->d.key then
      insert into public.crm_history_changes(event_id,definition_id,old_value,new_value)
        values(eid,d.id,before_row->d.key,after_row->d.key)
        on conflict(event_id,definition_id) do update set new_value=excluded.new_value;
    end if;
  end loop;
  return null;
end $$;
-- Trigger-only writer; clients cannot forge events or actor IDs.
revoke all on function public.crm_shared_capture_history() from public,anon,authenticated;
revoke all on function public.crm_shared_record_access(text,text,text),
  public.crm_shared_field_access(uuid,boolean) from public,anon;
grant execute on function public.crm_shared_record_access(text,text,text),
  public.crm_shared_field_access(uuid,boolean) to authenticated;

create function public.crm_shared_metadata(m text) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
  select jsonb_build_object(
    'fields',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'module',d.module,'key',d.key,'label',d.label,'type',d.type,
      'required',coalesce(r.required,d.required),'order',d.position,'choices',d.choices,
      'is_custom',d.is_custom,'relaxable',d.relaxable,
      'access',case when public.crm_shared_field_access(d.id,true) then 'write' else 'readonly' end)
      order by d.position,d.id)
      from public.crm_field_definitions d left join public.crm_field_requirements r on r.definition_id=d.id
      where d.module=m and public.crm_shared_field_access(d.id)),'[]'::jsonb),
    'layout',(select fields from public.crm_form_layouts where module=m))
$$;
create function public.crm_shared_values(m text,rid text) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
  select coalesce(jsonb_object_agg(d.key,v.value),'{}'::jsonb)
    from public.crm_custom_values v join public.crm_field_definitions d on d.id=v.definition_id
    where v.module=m and v.record_id=rid
$$;
create function public.crm_shared_save_values(m text,rid text,payload jsonb,complete boolean default false)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item record; fid uuid;
begin
  if not public.crm_shared_record_access(m,rid,'update') then
    raise exception 'Record unavailable' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>1048576 then
    raise exception 'Expected bounded field object';
  end if;
  for item in select * from jsonb_each(payload) loop
    select id into fid from public.crm_field_definitions where module=m and key=item.key and is_custom and not archived;
    if fid is null or not public.crm_shared_field_access(fid,true) then
      raise exception 'Field unavailable' using errcode='42501';
    end if;
    insert into public.crm_custom_values(module,record_id,definition_id,value)
      values(m,rid,fid,item.value) on conflict(module,record_id,definition_id)
      do update set value=excluded.value;
  end loop;
  if complete and exists(select 1 from public.crm_field_definitions d
    left join public.crm_field_requirements r on r.definition_id=d.id
    where d.module=m and d.is_custom and not d.archived and coalesce(r.required,d.required)
      and public.crm_shared_field_access(d.id,true)
      and not exists(select 1 from public.crm_custom_values v where v.definition_id=d.id and v.record_id=rid
        and v.module=m and v.value not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb))) then
    raise exception 'Missing required custom fields';
  end if;
end $$;

create function public.crm_shared_capture_custom_history() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare eid uuid;
begin
  if (tg_op='UPDATE' and old.value is not distinct from new.value)
    or exists(select 1 from public.crm_field_definitions where id=new.definition_id and sensitive) then return null; end if;
  insert into public.crm_history_events(module,record_id,action)
    values(new.module,new.record_id,'update')
    on conflict(module,record_id,transaction_id) do update set action=crm_history_events.action
    returning id into eid;
  insert into public.crm_history_changes(event_id,definition_id,old_value,new_value)
    values(eid,new.definition_id,case when tg_op='INSERT' then null else old.value end,new.value)
    on conflict(event_id,definition_id) do update set new_value=excluded.new_value;
  return null;
end $$;
create trigger crm_custom_history after insert or update on public.crm_custom_values
  for each row execute function public.crm_shared_capture_custom_history();
revoke all on function public.crm_shared_capture_custom_history() from public,anon,authenticated;

create function public.crm_shared_history(m text,rid text,lim integer default 50,off integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb;
begin
  if lim not between 1 and 100 or off not between 0 and 100000
    or not public.crm_shared_record_access(m,rid,'view') then raise exception 'Invalid history request'; end if;
  select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('changes',
    coalesce((select jsonb_agg(jsonb_build_object('field',d.key,'label',d.label,
      'old',c.old_value,'new',c.new_value)) from public.crm_history_changes c
      join public.crm_field_definitions d on d.id=c.definition_id
      where c.event_id=e.id and c.old_value is distinct from c.new_value),'[]'::jsonb))
    order by e.occurred_at desc,e.id desc),'[]'::jsonb) into result
    from (select * from public.crm_history_events where module=m and record_id=rid
      order by occurred_at desc,id desc limit lim offset off) e;
  return result;
end $$;

-- Preferences contain configuration only. They never execute SQL or widen RLS.
create function public.crm_shared_personalization(m text) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
  select jsonb_build_object(
    'views',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from public.crm_saved_views s where module=m),'[]'::jsonb),
    'preferences',coalesce((select jsonb_agg(to_jsonb(p)) from public.crm_view_preferences p where module=m),'[]'::jsonb),
    'recent',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select record_id,viewed_at from public.crm_recent_records where module=m order by viewed_at desc limit 100) r),'[]'::jsonb))
$$;
create function public.crm_shared_save_view(m text,n text,s jsonb,shared boolean default false,vid uuid default null)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result uuid;
begin
  if s is null or octet_length(s::text)>32768 or s->>'version' is distinct from '1' or jsonb_typeof(s)<>'object' then raise exception 'Invalid view state'; end if;
  if vid is null then
    insert into public.crm_saved_views(module,name,state,is_public) values(m,n,s,shared) returning id into result;
  else
    update public.crm_saved_views set name=n,state=s,is_public=shared where id=vid and module=m and user_id=auth.uid() returning id into result;
    if result is null then raise exception 'View unavailable'; end if;
  end if;
  return result;
end $$;
create function public.crm_shared_delete_view(vid uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  delete from public.crm_saved_views where id=vid and user_id=auth.uid();
  if not found then raise exception 'View unavailable'; end if;
end $$;
create function public.crm_shared_preferences(m text,ctx text,url text,s jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if octet_length(s::text)>32768 then raise exception 'Preference too large'; end if;
  insert into public.crm_view_preferences(module,context,url_name,state) values(m,ctx,url,s)
    on conflict(user_id,module,context,url_name) do update set state=excluded.state;
end $$;
create function public.crm_shared_touch_record(m text,rid text) returns void
language sql security invoker set search_path=pg_catalog,public as $$
  insert into public.crm_recent_records(module,record_id) values(m,rid)
    on conflict(user_id,module,record_id) do update set viewed_at=now()
$$;
-- Explicit EXECUTE grants; do not expose helpers through default PUBLIC privileges.
revoke all on function public.crm_shared_metadata(text),public.crm_shared_values(text,text),
  public.crm_shared_save_values(text,text,jsonb,boolean),public.crm_shared_history(text,text,integer,integer),
  public.crm_shared_personalization(text),public.crm_shared_save_view(text,text,jsonb,boolean,uuid),
  public.crm_shared_delete_view(uuid),public.crm_shared_preferences(text,text,text,jsonb),
  public.crm_shared_touch_record(text,text) from public,anon;
grant execute on function public.crm_shared_metadata(text),public.crm_shared_values(text,text),
  public.crm_shared_save_values(text,text,jsonb,boolean),public.crm_shared_history(text,text,integer,integer),
  public.crm_shared_personalization(text),public.crm_shared_save_view(text,text,jsonb,boolean,uuid),
  public.crm_shared_delete_view(uuid),public.crm_shared_preferences(text,text,text,jsonb),
  public.crm_shared_touch_record(text,text) to authenticated;
create function public.crm_shared_put_definition(payload jsonb) returns uuid
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare fid uuid;
begin
  fid=(payload->>'id')::uuid;
  if exists(select 1 from public.crm_field_definitions where id=fid and (not is_custom or archived)) then
    raise exception 'Built-in field metadata requires installer ownership';
  end if;
  insert into public.crm_field_definitions(id,module,key,label,type,required,position,choices)
    values(fid,payload->>'module',payload->>'key',payload->>'label',payload->>'type',
      (payload->>'required')::boolean,(payload->>'order')::integer,payload->'choices')
    on conflict(id) do update set label=excluded.label,type=excluded.type,required=excluded.required,
      position=excluded.position,choices=excluded.choices;
  return fid;
end $$;
create function public.crm_shared_delete_definition(fid uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  -- Tombstones preserve immutable history; no destructive definition/value purge API.
  update public.crm_field_definitions set archived=true where id=fid and is_custom and not archived;
  if not found then raise exception 'Definition unavailable'; end if;
end $$;
create function public.crm_shared_configure_form(m text,layout jsonb,requirements jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item record; fid uuid;
begin
  if layout is null or requirements is null or jsonb_typeof(layout)<>'array' or jsonb_array_length(layout)>200 or jsonb_typeof(requirements)<>'object'
    or octet_length(requirements::text)>32768 then raise exception 'Invalid form configuration'; end if;
  if (select count(*)<>count(distinct e->>'field') from jsonb_array_elements(layout) e)
    or exists(select 1 from jsonb_array_elements(layout) e
      where jsonb_typeof(e->'visible') is distinct from 'boolean'
        or e->>'sequence' is null or (e->>'sequence')::integer<0
        or not exists(select 1 from public.crm_field_definitions d where d.module=m and d.key=e->>'field')) then
    raise exception 'Invalid layout field';
  end if;
  insert into public.crm_form_layouts(module,fields) values(m,layout)
    on conflict(module) do update set fields=excluded.fields;
  for item in select * from jsonb_each(requirements) loop
    select id into fid from public.crm_field_definitions where module=m and key=item.key;
    if fid is null or jsonb_typeof(item.value)<>'boolean' then raise exception 'Invalid requiredness'; end if;
    insert into public.crm_field_requirements(definition_id,required) values(fid,(item.value #>> '{}')::boolean)
      on conflict(definition_id) do update set required=excluded.required;
  end loop;
end $$;
revoke all on function public.crm_shared_put_definition(jsonb),public.crm_shared_delete_definition(uuid),
  public.crm_shared_configure_form(text,jsonb,jsonb) from public,anon;
grant execute on function public.crm_shared_put_definition(jsonb),public.crm_shared_delete_definition(uuid),
  public.crm_shared_configure_form(text,jsonb,jsonb) to authenticated;

create function public.crm_shared_validate_state() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item jsonb; fid uuid; s jsonb;
begin
  s=new.state;
  if s is null or jsonb_typeof(s)<>'object' or octet_length(s::text)>32768 then raise exception 'Invalid state'; end if;
  if tg_table_name='crm_saved_views' then
    if s->>'version' is distinct from '1'
      or s->>'logic' is null or s->>'logic' not in ('AND','OR')
      or jsonb_typeof(s->'filters') is distinct from 'array'
      or jsonb_array_length(s->'filters')>50
      or jsonb_typeof(s->'sort') is distinct from 'array'
      or jsonb_array_length(s->'sort')>5 then raise exception 'Invalid query state'; end if;
    for item in select * from jsonb_array_elements(s->'filters') loop
      select id into fid from public.crm_field_definitions where module=new.module and key=item->>'field';
      if fid is null or not public.crm_shared_field_access(fid)
        or item->>'operator' is null or item->>'operator' not in ('exact','ne','icontains','istartswith','iendswith','gt','gte','lt','lte',
          'between','isnull','isnotnull','today','yesterday','this_week','this_month') then raise exception 'Unavailable filter'; end if;
    end loop;
    for item in select * from jsonb_array_elements(s->'sort') loop
      select id into fid from public.crm_field_definitions where module=new.module and key=item->>'field';
      if fid is null or not public.crm_shared_field_access(fid) or item->>'direction' is null or item->>'direction' not in ('asc','desc') then
        raise exception 'Unavailable sort'; end if;
    end loop;
  end if;
  if s ? 'columns' then
    if jsonb_typeof(s->'columns')<>'array' or jsonb_array_length(s->'columns')>100 then raise exception 'Invalid columns'; end if;
    for item in select * from jsonb_array_elements(s->'columns') loop
      select id into fid from public.crm_field_definitions where module=new.module and key=item #>> '{}';
      if fid is null or not public.crm_shared_field_access(fid) then raise exception 'Unavailable column'; end if;
    end loop;
  end if;
  return new;
end $$;
create trigger crm_saved_state_validation before insert or update on public.crm_saved_views
  for each row execute function public.crm_shared_validate_state();
create trigger crm_preferences_validation before insert or update on public.crm_view_preferences
  for each row execute function public.crm_shared_validate_state();
revoke all on function public.crm_shared_validate_state() from public,anon,authenticated;
commit;
