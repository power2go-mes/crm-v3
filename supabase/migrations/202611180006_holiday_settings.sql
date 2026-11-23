begin;
create table public.crm_holidays(
 id uuid primary key default gen_random_uuid(),definition jsonb not null,
 name text generated always as (definition->>'name') stored,
 is_recurring boolean generated always as ((definition->>'is_recurring')::boolean) stored,
 all_users boolean generated always as ((definition->>'all_users')::boolean) stored,
 start_date timestamptz not null,end_date timestamptz not null check(start_date<=end_date),
 created_by_id uuid references public.user_profiles(id) on delete set null,
 updated_by_id uuid references public.user_profiles(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index holidays_date_idx on public.crm_holidays(start_date desc,id);
create index holidays_company_idx on public.crm_holidays(all_users,start_date,id);
create table public.crm_holiday_users(holiday_id uuid not null references public.crm_holidays on delete cascade,user_id uuid not null references public.user_profiles on delete cascade,primary key(holiday_id,user_id));
create index holiday_users_user_idx on public.crm_holiday_users(user_id,holiday_id);
create table public.business_hour_holidays(business_hour_id integer not null references public.business_hours on delete cascade,holiday_id uuid not null references public.crm_holidays on delete cascade,primary key(business_hour_id,holiday_id));
insert into public.permissions(id,module,action,description) values
 ('holidays.view','holidays','view','View scoped company and personal holidays'),
 ('holidays.create','holidays','create','Create company and scoped personal holidays'),
 ('holidays.update','holidays','update','Edit scoped holidays'),
 ('holidays.delete','holidays','delete','Delete scoped holidays') on conflict(id) do nothing;

create function public.can_access_holiday(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and public.has_effective_permission(auth.uid(),'holidays.view') and exists(
 select 1 from public.crm_holidays h where h.id=p_id and (
 h.definition->>'all_users'='true' or (
 (h.created_by_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())) or exists(select 1 from public.crm_holiday_users u where u.holiday_id=h.id and u.user_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))))
 and not exists(select 1 from public.crm_holiday_users u where u.holiday_id=h.id and u.user_id not in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())))
 )))
$$;
alter table public.crm_holidays enable row level security;
alter table public.crm_holiday_users enable row level security;
alter table public.business_hour_holidays enable row level security;
create policy holiday_read on public.crm_holidays for select to authenticated using(public.can_access_holiday(id));
create policy holiday_users_read on public.crm_holiday_users for select to authenticated using(public.can_access_holiday(holiday_id));
create policy business_holiday_read on public.business_hour_holidays for select to authenticated using(public.has_effective_permission(auth.uid(),'business_hours.view') and public.can_access_holiday(holiday_id));
revoke all on public.crm_holidays,public.crm_holiday_users,public.business_hour_holidays from public,anon,authenticated;
grant select on public.crm_holidays,public.crm_holiday_users,public.business_hour_holidays to authenticated;

create function public.save_holiday(p_id uuid,p_definition jsonb,p_users uuid[]) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare d jsonb=p_definition; result_id uuid; frequency text; prefix text; k text; n text; f text[];
 recurrence text[]=array['frequency','recurs_every_weeks','weekly_days','monthly_repeat_type','monthly_day_of_month','monthly_interval','monthly_day_of_week','monthly_week_of_month','yearly_repeat_type','yearly_week_of_month','yearly_day_of_month','yearly_day_of_week','yearly_month'];
begin
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),'holidays.view') or not public.has_effective_permission(auth.uid(),case when p_id is null then 'holidays.create' else 'holidays.update' end) then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_id is not null then
  perform 1 from public.crm_holidays where id=p_id for update;
  if not found or not public.can_access_holiday(p_id) then raise exception 'Holiday unavailable' using errcode='42501'; end if;
 end if;
 if d is null or jsonb_typeof(d)<>'object' or d-array['name','start_date','end_date','all_users','is_recurring','frequency','recurs_every_weeks','weekly_days','monthly_repeat_type','monthly_day_of_month','monthly_interval','monthly_day_of_week','monthly_week_of_month','yearly_repeat_type','yearly_week_of_month','yearly_day_of_month','yearly_day_of_week','yearly_month']<>'{}'::jsonb
 or (select count(*) from jsonb_object_keys(d))<>18
 or jsonb_typeof(d->'name')<>'string' or length(btrim(d->>'name')) not between 1 and 255
 or jsonb_typeof(d->'start_date')<>'string' or jsonb_typeof(d->'end_date')<>'string'
 or coalesce(d->>'start_date','') !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' or coalesce(d->>'end_date','') !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
 or jsonb_typeof(d->'all_users')<>'boolean' or jsonb_typeof(d->'is_recurring')<>'boolean'
 then raise exception 'Invalid holiday fields' using errcode='23514'; end if;
 if (d->>'start_date')::timestamptz > (d->>'end_date')::timestamptz then raise exception 'Start date cannot be after end date' using errcode='23514'; end if;
 if p_users is null or cardinality(p_users)>200 or array_position(p_users,null) is not null or cardinality(p_users)<>(select count(distinct x) from unnest(p_users) x) then raise exception 'Invalid selected users' using errcode='23514'; end if;
 if (d->>'all_users')::boolean then p_users='{}'::uuid[];
 elsif cardinality(p_users)=0 then raise exception 'Specific Users is required' using errcode='23514';
 elsif not public.has_effective_permission(auth.uid(),'users.view') or exists(select 1 from unnest(p_users) x where not exists(select 1 from public.user_profiles u where u.id=x) or x not in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))) then raise exception 'Selected user is outside your authorized scope' using errcode='42501'; end if;
 frequency=d->>'frequency';
 if (d->>'is_recurring')::boolean then
  if frequency is null or frequency not in ('weekly','monthly','yearly') then raise exception 'Frequency is required for recurring holidays' using errcode='23514'; end if;
  if frequency='weekly' then
   if jsonb_typeof(d->'weekly_days')<>'array' then raise exception 'Weekly Days is required' using errcode='23514'; end if;
   select array_agg(value) into f from jsonb_array_elements_text(d->'weekly_days');
   if coalesce(cardinality(f),0)=0 or not f <@ array['mon','tue','wed','thu','fri','sat','sun'] or cardinality(f)<>(select count(distinct x) from unnest(f) x) then raise exception 'Weekly days must be specified for weekly recurrence' using errcode='23514'; end if;
  else
   prefix=frequency||'_';
   if coalesce(d->>(prefix||'repeat_type'),'') not in ('day_of_month','weekday_of_month') then raise exception 'Select a valid repeat type' using errcode='23514'; end if;
   if d->>(prefix||'repeat_type')='weekday_of_month' and coalesce(d->>(prefix||'day_of_week'),'') not in ('mon','tue','wed','thu','fri','sat','sun') then raise exception 'Day of Week is required' using errcode='23514'; end if;
   if frequency='yearly' and coalesce(d->>'yearly_month','') not in ('january','february','march','april','may','june','july','august','september','october','november','december') then raise exception 'Month is required for yearly recurrence' using errcode='23514'; end if;
  end if;
  f=case when frequency='weekly' then array['recurs_every_weeks'] when frequency='monthly' and d->>'monthly_repeat_type'='day_of_month' then array['monthly_day_of_month'] when frequency='monthly' then array['monthly_week_of_month'] when d->>'yearly_repeat_type'='day_of_month' then array['yearly_day_of_month'] else array['yearly_week_of_month'] end;
  foreach k in array f loop
   n=d->>k;
   if n is null or n !~ '^[0-9]+$' then raise exception 'A positive recurrence number is required' using errcode='23514'; end if;
   if n::numeric<1 or n::numeric>2147483647 then raise exception 'Invalid recurrence number' using errcode='23514'; end if;
  end loop;
  if frequency='monthly' and d->>'monthly_repeat_type'='day_of_month' and d->>'monthly_interval' is not null then
   n=d->>'monthly_interval';
   if n !~ '^[0-9]+$' then raise exception 'Invalid Monthly Interval' using errcode='23514'; end if;
   if n::numeric>2147483647 then raise exception 'Invalid Monthly Interval' using errcode='23514'; end if;
  end if;
 else frequency=null; end if;
 -- Clear hidden dependent values instead of retaining stale recurrence settings.
 foreach k in array recurrence loop
  if frequency is null or k not in ('frequency') and (
   frequency='weekly' and k not in ('recurs_every_weeks','weekly_days') or
   frequency='monthly' and k not like 'monthly_%' or
   frequency='yearly' and k not like 'yearly_%'
  ) then d=jsonb_set(d,array[k],case when k='weekly_days' then '[]'::jsonb else 'null'::jsonb end); end if;
 end loop;
 if frequency in ('monthly','yearly') then
  prefix=frequency||'_';
  if d->>(prefix||'repeat_type')='day_of_month' then
   d=jsonb_set(jsonb_set(d,array[prefix||'day_of_week'],'null'),array[prefix||'week_of_month'],'null');
  else
   d=jsonb_set(d,array[prefix||'day_of_month'],'null');
   if frequency='monthly' then d=jsonb_set(d,'{monthly_interval}','null'); end if;
  end if;
 end if;
 d=jsonb_set(d,'{name}',to_jsonb(btrim(d->>'name')));
 if p_id is null then
  insert into public.crm_holidays(definition,start_date,end_date,created_by_id,updated_by_id) values(d,(d->>'start_date')::timestamptz,(d->>'end_date')::timestamptz,auth.uid(),auth.uid()) returning id into result_id;
 else
  update public.crm_holidays set definition=d,start_date=(d->>'start_date')::timestamptz,end_date=(d->>'end_date')::timestamptz,updated_by_id=auth.uid(),updated_at=now() where id=p_id returning id into result_id;
 end if;
 delete from public.crm_holiday_users where holiday_id=result_id;
 insert into public.crm_holiday_users select result_id,x from unnest(p_users) x;
 return result_id;
end $$;

create function public.delete_holiday(p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.has_effective_permission(auth.uid(),'holidays.delete') then raise exception 'Permission denied' using errcode='42501'; end if;
 perform 1 from public.crm_holidays where id=p_id for update;
 if not public.has_effective_permission(auth.uid(),'holidays.delete') or not public.can_access_holiday(p_id) then raise exception 'Permission denied' using errcode='42501'; end if;
 delete from public.crm_holidays where id=p_id;
 if not found then raise exception 'Holiday unavailable' using errcode='P0002'; end if;
end $$;
create function public.set_business_hour_holidays(p_ids uuid[],p_remove boolean default false) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare hid uuid; begin
 if not public.has_effective_permission(auth.uid(),'business_hours.view') or not public.has_effective_permission(auth.uid(),'business_hours.update') or not public.has_effective_permission(auth.uid(),'holidays.view') then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_remove is null or p_ids is null or cardinality(p_ids) not between 1 and 200 or array_position(p_ids,null) is not null or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'Select Holidays' using errcode='23514'; end if;
 perform 1 from public.business_hours where id=1 for update;
 if not found then raise exception 'Business hours unavailable' using errcode='P0002'; end if;
 foreach hid in array p_ids loop
  perform 1 from public.crm_holidays where id=hid for share;
  if not found or not public.can_access_holiday(hid) or not p_remove and not exists(select 1 from public.crm_holidays where id=hid and definition->>'all_users'='true') then raise exception 'Only accessible company holidays can be linked' using errcode='42501'; end if;
 end loop;
 if p_remove then delete from public.business_hour_holidays where business_hour_id=1 and holiday_id=any(p_ids);
 else insert into public.business_hour_holidays select 1,x from unnest(p_ids) x on conflict do nothing; end if;
end $$;
revoke all on function public.can_access_holiday(uuid),public.save_holiday(uuid,jsonb,uuid[]),public.delete_holiday(uuid),public.set_business_hour_holidays(uuid[],boolean) from public,anon;
grant execute on function public.can_access_holiday(uuid),public.save_holiday(uuid,jsonb,uuid[]),public.delete_holiday(uuid),public.set_business_hour_holidays(uuid[],boolean) to authenticated;
create function public.business_holiday_catalog(p_linked boolean,p_search text default '',p_page integer default 1) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare result jsonb; begin
 if not public.has_effective_permission(auth.uid(),'business_hours.view') or not public.has_effective_permission(auth.uid(),'holidays.view') then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_linked is null or p_search is null or length(p_search)>200 or p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid holiday page' using errcode='22023'; end if;
 with filtered as (
  select h.id,h.name,h.definition,h.start_date,h.end_date from public.crm_holidays h
  where (p_linked or h.all_users) and strpos(lower(h.name),lower(btrim(p_search)))>0 and
  exists(select 1 from public.business_hour_holidays b where b.business_hour_id=1 and b.holiday_id=h.id)=p_linked
 ), paged as (select * from filtered order by start_date,name,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.business_holiday_catalog(boolean,text,integer) from public,anon;
grant execute on function public.business_holiday_catalog(boolean,text,integer) to authenticated;
commit;
