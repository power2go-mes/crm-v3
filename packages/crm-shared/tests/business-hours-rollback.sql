do $$ begin assert not exists(select 1 from public.business_hours),'Existing schedule present: fixture must not replace it'; end $$;
insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000001201','hours-test@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_HOURS_TEST','Business hours fixture',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001201','CODEX_HOURS_TEST');
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001201',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001201","role":"authenticated"}',true);
select set_config('crm.hours_fixture','{"name":"CODEX business hours","time_zone":"UTC","week_start_day":"mon","business_hour_type":"24_7","timing_type":null,"week_days":[],"default_start_time":null,"default_end_time":null,"day_hours":{"mon":{"start":null,"end":null},"tue":{"start":null,"end":null},"wed":{"start":null,"end":null},"thu":{"start":null,"end":null},"fri":{"start":null,"end":null},"sat":{"start":null,"end":null},"sun":{"start":null,"end":null}},"is_active":true}',true);
set local role authenticated;
do $$ declare caught boolean=false; begin
 assert (select count(*) from public.business_hours)=0,'Read denial';
 begin perform public.save_business_hours(current_setting('crm.hours_fixture')::jsonb,true); exception when insufficient_privilege then caught=true; end; assert caught,'No-feature write';
end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) select 'CODEX_HOURS_TEST',id,true from public.permissions where module='business_hours';
set local role authenticated;
do $$ declare d jsonb=current_setting('crm.hours_fixture')::jsonb; prior jsonb; caught boolean=false; begin
 perform public.save_business_hours(d,true);
 assert (select updated_by_id=auth.uid() and jsonb_array_length(definition->'week_days')=7 from public.business_hours where id=1),'Create/actor/24x7 normalization';
 begin perform public.save_business_hours(d,true); exception when unique_violation then caught=true; end; assert caught,'Duplicate schedule'; caught=false;
 d=d||'{"business_hour_type":"24_5","week_days":["mon","tue","wed","thu","fri","sat"]}'::jsonb;
 begin perform public.save_business_hours(d,false); exception when check_violation then caught=true; end; assert caught,'24x5 day limit'; caught=false;
 d=d||'{"business_hour_type":"custom","timing_type":"same","week_days":["mon","wed"],"default_start_time":"22:00","default_end_time":"06:00"}';
 perform public.save_business_hours(d,false);
 assert (select definition->'day_hours'->'mon'->>'start'='22:00' and definition->'day_hours'->'wed'->>'end'='06:00' and definition->'day_hours'->'tue'->>'start' is null from public.business_hours),'Same hours/day normalization or overnight rejected';
 d=jsonb_set(d||'{"timing_type":"different"}', '{day_hours,fri}','{"start":"09:30","end":"17:00"}');
 perform public.save_business_hours(d,false);
 assert (select definition->'week_days'='["fri"]'::jsonb and definition->>'default_start_time' is null from public.business_hours),'Different hours derive selected days';
 select definition into prior from public.business_hours where id=1;
 begin perform public.save_business_hours(d||'{"time_zone":"Invalid/Zone"}',false); exception when check_violation then caught=true; end; assert caught,'Invalid timezone'; caught=false;
 begin perform public.save_business_hours(d||'{"actor":"forged"}',false); exception when check_violation then caught=true; end; assert caught,'Forged actor'; caught=false;
 begin perform public.save_business_hours(jsonb_set(d,'{day_hours,fri,start}','"25:00"'),false); exception when check_violation then caught=true; end; assert caught,'Invalid time'; caught=false;
 assert (select definition=prior from public.business_hours where id=1),'Failed update partially persisted';
 begin update public.business_hours set definition='{}' where id=1; exception when insufficient_privilege then caught=true; end; assert caught,'Raw write bypass';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_HOURS_TEST' and permission_id='business_hours.update';
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.save_business_hours(current_setting('crm.hours_fixture')::jsonb,false); exception when insufficient_privilege then caught=true; end; assert caught,'Revocation bypass';
end $$;
reset role;
delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000001201';
do $$ declare canonical text; expected boolean; actual boolean; begin
 foreach canonical in array array['SUPER_ADMIN','HEAD_OF_SALES','RSM','SSM','ASM','BDO'] loop
  insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001201',canonical);
  expected=public.has_effective_permission('c0de0000-0000-4000-8000-000000001201','business_hours.view');
  set local role authenticated;
  select exists(select 1 from public.business_hours) into actual;
  assert actual=expected,'Canonical role bypassed feature permission';
  reset role;
  delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000001201';
 end loop;
 assert not has_function_privilege('anon','public.save_business_hours(jsonb,boolean)','execute'),'Anonymous execution';
end $$;
