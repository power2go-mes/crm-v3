begin;
create table public.crm_shift_hours(id uuid primary key default gen_random_uuid(),definition jsonb not null,name text generated always as(definition->>'name') stored,created_by_id uuid references public.user_profiles on delete set null,updated_by_id uuid references public.user_profiles on delete set null,updated_at timestamptz not null default now());
create table public.crm_shift_users(shift_id uuid not null references public.crm_shift_hours on delete cascade,user_id uuid not null references public.user_profiles on delete cascade,primary key(shift_id,user_id));
create index shift_users_user_idx on public.crm_shift_users(user_id,shift_id);
insert into public.permissions(id,module,action,description) values('business_hours.delete','business_hours','delete','Delete named shift hours') on conflict(id) do nothing;
create function public.can_access_shift(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and public.has_effective_permission(auth.uid(),'business_hours.view') and exists(select 1 from public.crm_shift_hours s where s.id=p_id and not exists(select 1 from public.crm_shift_users u where u.shift_id=s.id and u.user_id not in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))))
$$;
alter table public.crm_shift_hours enable row level security;
alter table public.crm_shift_users enable row level security;
create policy shift_read on public.crm_shift_hours for select to authenticated using(public.can_access_shift(id));
create policy shift_users_read on public.crm_shift_users for select to authenticated using(public.can_access_shift(shift_id));
revoke all on public.crm_shift_hours,public.crm_shift_users from public,anon,authenticated;
grant select on public.crm_shift_hours,public.crm_shift_users to authenticated;

create function public.normalize_shift_block(p_block jsonb,p_break boolean) returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare b jsonb=p_block; day text; pair jsonb; t text; days text[]; normalized text[]='{}'; begin
 if b is null or jsonb_typeof(b)<>'object' or b-array['mode','days','start','end','per_day']<>'{}'::jsonb or (select count(*) from jsonb_object_keys(b))<>5 or jsonb_typeof(b->'days')<>'array' or jsonb_typeof(b->'per_day')<>'object'
 or coalesce(b->>'mode','') not in ('same','different','none') or (not p_break and b->>'mode'='none') then raise exception 'Invalid shift timing fields' using errcode='23514'; end if;
 select coalesce(array_agg(value),'{}') into days from jsonb_array_elements_text(b->'days');
 if not days <@ array['mon','tue','wed','thu','fri','sat','sun'] or cardinality(days)<>(select count(distinct x) from unnest(days) x) or (b->'per_day')-array['mon','tue','wed','thu','fri','sat','sun']<>'{}'::jsonb or (select count(*) from jsonb_object_keys(b->'per_day'))<>7 then raise exception 'Invalid shift weekdays' using errcode='23514'; end if;
 foreach day in array array['mon','tue','wed','thu','fri','sat','sun'] loop
  pair=b->'per_day'->day;
  if jsonb_typeof(pair)<>'object' or pair-array['start','end']<>'{}'::jsonb or (select count(*) from jsonb_object_keys(pair))<>2 then raise exception 'Invalid daily shift pair' using errcode='23514'; end if;
  foreach t in array array[pair->>'start',pair->>'end'] loop if t is not null and t !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise exception 'Invalid time format' using errcode='23514'; end if; end loop;
 end loop;
 foreach t in array array[b->>'start',b->>'end'] loop if t is not null and t !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise exception 'Invalid time format' using errcode='23514'; end if; end loop;
 if b->>'mode'='none' then days='{}';b=jsonb_set(jsonb_set(b,'{start}','null'),'{end}','null');
 elsif b->>'mode'='same' then
  if cardinality(days)=0 or b->>'start' is null or b->>'end' is null then raise exception 'Select weekdays and enter start and end times' using errcode='23514'; end if;
  if (b->>'start')::time >= (b->>'end')::time then raise exception 'End time must be after start on the same day. Use 24-hour time.' using errcode='23514'; end if;
 else
  foreach day in array array['mon','tue','wed','thu','fri','sat','sun'] loop
   pair=b->'per_day'->day;
   if pair->>'start' is not null and pair->>'end' is not null then
    if (pair->>'start')::time >= (pair->>'end')::time then raise exception 'End time must be after start on the same day. Use 24-hour time.' using errcode='23514'; end if;
    normalized=array_append(normalized,day);
   end if;
  end loop;
  if cardinality(normalized)=0 then raise exception 'Enter start and end for at least one weekday' using errcode='23514'; end if;
  days=normalized;b=jsonb_set(jsonb_set(b,'{start}','null'),'{end}','null');
 end if;
 foreach day in array array['mon','tue','wed','thu','fri','sat','sun'] loop
  if not day=any(days) then b=jsonb_set(b,array['per_day',day],'{"start":null,"end":null}');
  elsif b->>'mode'='same' then b=jsonb_set(b,array['per_day',day],jsonb_build_object('start',b->'start','end',b->'end')); end if;
 end loop;
 return jsonb_set(b,'{days}',to_jsonb(days));
end $$;
create function public.save_shift_hours(p_id uuid,p_definition jsonb,p_users uuid[]) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare d jsonb=p_definition; main jsonb; br jsonb; slot text; day text; result_id uuid; begin
 if not public.has_effective_permission(auth.uid(),'business_hours.view') or not public.has_effective_permission(auth.uid(),case when p_id is null then 'business_hours.create' else 'business_hours.update' end) then raise exception 'Permission denied' using errcode='42501'; end if;
 if d is null or jsonb_typeof(d)<>'object' or d-array['name','time_zone','is_active','main','break1','break2']<>'{}'::jsonb or (select count(*) from jsonb_object_keys(d))<>6 or jsonb_typeof(d->'name')<>'string' or length(btrim(d->>'name')) not between 1 and 255 or jsonb_typeof(d->'is_active')<>'boolean' or jsonb_typeof(d->'time_zone')<>'string' or not exists(select 1 from pg_timezone_names where name=d->>'time_zone') then raise exception 'Invalid shift fields' using errcode='23514'; end if;
 if p_users is null or cardinality(p_users)>200 or array_position(p_users,null) is not null or cardinality(p_users)<>(select count(distinct x) from unnest(p_users) x) then raise exception 'Invalid Assigned Users' using errcode='23514'; end if;
 if cardinality(p_users)>0 and (not public.has_effective_permission(auth.uid(),'users.view') or exists(select 1 from unnest(p_users) x where not exists(select 1 from public.user_profiles u where u.id=x) or x not in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())))) then raise exception 'Assigned user is outside your authorized scope' using errcode='42501'; end if;
 main=public.normalize_shift_block(d->'main',false);d=jsonb_set(d,'{main}',main);
 foreach slot in array array['break1','break2'] loop
  br=public.normalize_shift_block(d->slot,true);
  for day in select jsonb_array_elements_text(br->'days') loop
   if not main->'days' @> to_jsonb(array[day]) or (br->'per_day'->day->>'start')::time < (main->'per_day'->day->>'start')::time or (br->'per_day'->day->>'end')::time > (main->'per_day'->day->>'end')::time then raise exception 'Break must fall within the shift working days and hours' using errcode='23514'; end if;
  end loop;
  d=jsonb_set(d,array[slot],br);
 end loop;
 d=jsonb_set(d,'{name}',to_jsonb(btrim(d->>'name')));
 if p_id is null then
  perform pg_advisory_xact_lock(180007,1);
  if (select count(*) from public.crm_shift_hours)>=50 then raise exception 'You can define at most 50 shift hours per company.' using errcode='23514'; end if;
  insert into public.crm_shift_hours(definition,created_by_id,updated_by_id) values(d,auth.uid(),auth.uid()) returning id into result_id;
 else
  perform 1 from public.crm_shift_hours where id=p_id for update;
  if not found or not public.can_access_shift(p_id) then raise exception 'Shift unavailable' using errcode='42501'; end if;
  update public.crm_shift_hours set definition=d,updated_by_id=auth.uid(),updated_at=now() where id=p_id returning id into result_id;
 end if;
 delete from public.crm_shift_users where shift_id=result_id;
 insert into public.crm_shift_users select result_id,x from unnest(p_users) x;
 return result_id;
end $$;
create function public.delete_shift_hours(p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_effective_permission(auth.uid(),'business_hours.delete') then raise exception 'Permission denied' using errcode='42501'; end if;
 perform 1 from public.crm_shift_hours where id=p_id for update;
 if not found or not public.can_access_shift(p_id) then raise exception 'Shift unavailable' using errcode='42501'; end if;
 delete from public.crm_shift_hours where id=p_id;
end $$;
create function public.shift_hours_catalog(p_page integer default 1,p_search text default '') returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb;begin
 if not public.has_effective_permission(auth.uid(),'business_hours.view') then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_page is null or p_page<1 or p_page>100000 or p_search is null or length(p_search)>200 then raise exception 'Invalid shift page' using errcode='22023'; end if;
 with filtered as(select id,definition from public.crm_shift_hours where strpos(lower(name),lower(btrim(p_search)))>0), paged as(select * from filtered order by definition->>'name',id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'definition',p.definition,'users',coalesce((select jsonb_agg(user_id) from public.crm_shift_users where shift_id=p.id),'[]'::jsonb))) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.can_access_shift(uuid),public.normalize_shift_block(jsonb,boolean),public.save_shift_hours(uuid,jsonb,uuid[]),public.delete_shift_hours(uuid),public.shift_hours_catalog(integer,text) from public,anon;
revoke all on function public.normalize_shift_block(jsonb,boolean) from authenticated;
grant execute on function public.can_access_shift(uuid),public.save_shift_hours(uuid,jsonb,uuid[]),public.delete_shift_hours(uuid),public.shift_hours_catalog(integer,text) to authenticated;
commit;
