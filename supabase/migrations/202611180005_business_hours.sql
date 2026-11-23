begin;
-- One schedule per company is enforced by the source form; v3 has one company.
create table public.business_hours (
 id integer primary key check(id=1),
 definition jsonb not null,
 updated_by_id uuid references public.user_profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.business_hours enable row level security;
create policy hours_read on public.business_hours for select to authenticated using(public.has_effective_permission(auth.uid(),'business_hours.view'));
revoke all on public.business_hours from public,anon,authenticated;
grant select on public.business_hours to authenticated;
insert into public.permissions(id,module,action,description) values
 ('business_hours.view','business_hours','view','View company business hours'),
 ('business_hours.create','business_hours','create','Add the company business hour schedule'),
 ('business_hours.update','business_hours','update','Edit company business hours') on conflict(id) do nothing;

create function public.save_business_hours(p_definition jsonb,p_create boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d jsonb=p_definition; day text; pair jsonb; days text[]; normalized text[]='{}'; start_at text; end_at text; begin
 if p_create is null or auth.uid() is null or not public.has_effective_permission(auth.uid(),'business_hours.view') or not public.has_effective_permission(auth.uid(),case when p_create then 'business_hours.create' else 'business_hours.update' end) then raise exception 'Permission denied' using errcode='42501'; end if;
 if d is null or jsonb_typeof(d)<>'object' or d - array['name','time_zone','week_start_day','business_hour_type','timing_type','week_days','default_start_time','default_end_time','day_hours','is_active'] <> '{}'::jsonb
 or (select count(*) from jsonb_object_keys(d))<>10
 or jsonb_typeof(d->'name')<>'string' or length(btrim(d->>'name')) not between 1 and 255
 or jsonb_typeof(d->'time_zone')<>'string' or not exists(select 1 from pg_timezone_names where name=d->>'time_zone')
 or coalesce(d->>'week_start_day','') not in ('mon','tue','wed','thu','fri','sat','sun')
 or coalesce(d->>'business_hour_type','') not in ('24_7','24_5','custom')
 or jsonb_typeof(d->'is_active')<>'boolean' or jsonb_typeof(d->'week_days')<>'array'
 or jsonb_typeof(d->'day_hours')<>'object' then raise exception 'Invalid business hour fields' using errcode='23514'; end if;
 select coalesce(array_agg(value),'{}') into days from jsonb_array_elements_text(d->'week_days');
 if not days <@ array['mon','tue','wed','thu','fri','sat','sun'] or cardinality(days)<>(select count(distinct x) from unnest(days) x) then raise exception 'Invalid week days' using errcode='23514'; end if;
 if (d->'day_hours') - array['mon','tue','wed','thu','fri','sat','sun'] <> '{}'::jsonb or (select count(*) from jsonb_object_keys(d->'day_hours'))<>7 then raise exception 'Invalid daily hours' using errcode='23514'; end if;
 foreach day in array array['mon','tue','wed','thu','fri','sat','sun'] loop
  pair=d->'day_hours'->day;
  if jsonb_typeof(pair)<>'object' or pair - array['start','end'] <> '{}'::jsonb or (select count(*) from jsonb_object_keys(pair))<>2 then raise exception 'Invalid daily time pair' using errcode='23514'; end if;
  foreach start_at in array array[pair->>'start',pair->>'end'] loop
   if start_at is not null and start_at !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise exception 'Invalid time' using errcode='23514'; end if;
  end loop;
 end loop;
 foreach start_at in array array[d->>'default_start_time',d->>'default_end_time'] loop
  if start_at is not null and start_at !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise exception 'Invalid time' using errcode='23514'; end if;
 end loop;
 if d->>'business_hour_type'='24_7' then days=array['sun','mon','tue','wed','thu','fri','sat']; end if;
 if d->>'business_hour_type'='24_5' and cardinality(days)>5 then raise exception 'You can select a maximum of 5 days for 24x5 business hours.' using errcode='23514'; end if;
 if d->>'business_hour_type'='custom' then
  if coalesce(d->>'timing_type','') not in ('same','different') then raise exception 'Select Timing Type' using errcode='23514'; end if;
  if d->>'timing_type'='different' then
   foreach day in array array['mon','tue','wed','thu','fri','sat','sun'] loop
    if d->'day_hours'->day->>'start' is not null and d->'day_hours'->day->>'end' is not null then normalized=array_append(normalized,day); end if;
   end loop; days=normalized;
   d=jsonb_set(jsonb_set(d,'{default_start_time}','null'),'{default_end_time}','null');
  else
   foreach day in array array['mon','tue','wed','thu','fri','sat','sun'] loop
    d=jsonb_set(d,array['day_hours',day],case when day=any(days) then jsonb_build_object('start',d->'default_start_time','end',d->'default_end_time') else '{"start":null,"end":null}'::jsonb end);
   end loop;
  end if;
 else
  d=jsonb_set(jsonb_set(jsonb_set(d,'{timing_type}','null'),'{default_start_time}','null'),'{default_end_time}','null');
  foreach day in array array['mon','tue','wed','thu','fri','sat','sun'] loop d=jsonb_set(d,array['day_hours',day],'{"start":null,"end":null}'); end loop;
 end if;
 d=jsonb_set(jsonb_set(d,'{name}',to_jsonb(btrim(d->>'name'))),'{week_days}',to_jsonb(days));
 perform pg_advisory_xact_lock(180005,1);
 if p_create then
  if exists(select 1 from public.business_hours) then raise exception 'You can only add one business hour per company.' using errcode='23505'; end if;
  insert into public.business_hours values(1,d,auth.uid(),now());
 else
  update public.business_hours set definition=d,updated_by_id=auth.uid(),updated_at=now() where id=1;
  if not found then raise exception 'Business hours are unavailable.' using errcode='P0002'; end if;
 end if;
end $$;
revoke all on function public.save_business_hours(jsonb,boolean) from public,anon;
grant execute on function public.save_business_hours(jsonb,boolean) to authenticated;
commit;
