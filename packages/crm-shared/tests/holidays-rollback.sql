insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000001301','holiday-fixture@example.invalid'),('c0de0000-0000-4000-8000-000000001302','holiday-other@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_HOLIDAY_TEST','Holiday fixture',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001301','CODEX_HOLIDAY_TEST'),('c0de0000-0000-4000-8000-000000001302','CODEX_HOLIDAY_TEST');
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001301',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001301","role":"authenticated"}',true);
select set_config('crm.holiday_fixture','{"name":"CODEX Holiday","start_date":"2026-12-01T09:00:00Z","end_date":"2026-12-01T18:00:00Z","all_users":true,"is_recurring":false,"frequency":null,"recurs_every_weeks":1,"weekly_days":[],"monthly_repeat_type":null,"monthly_day_of_month":null,"monthly_interval":1,"monthly_day_of_week":null,"monthly_week_of_month":null,"yearly_repeat_type":null,"yearly_week_of_month":null,"yearly_day_of_month":null,"yearly_day_of_week":null,"yearly_month":null}',true);
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.save_holiday(null,current_setting('crm.holiday_fixture')::jsonb,'{}'); exception when insufficient_privilege then caught=true; end; assert caught,'Missing feature accepted';
end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) select 'CODEX_HOLIDAY_TEST',id,true from public.permissions where module in ('holidays','business_hours') or id='users.view';
-- Do not overwrite an existing company schedule. A synthetic schedule is inserted only if empty.
insert into public.business_hours(id,definition) select 1,'{"name":"CODEX fixture","time_zone":"UTC","week_start_day":"mon","business_hour_type":"24_7","timing_type":null,"week_days":[],"default_start_time":null,"default_end_time":null,"day_hours":{"mon":{"start":null,"end":null},"tue":{"start":null,"end":null},"wed":{"start":null,"end":null},"thu":{"start":null,"end":null},"fri":{"start":null,"end":null},"sat":{"start":null,"end":null},"sun":{"start":null,"end":null}},"is_active":true}'::jsonb where not exists(select 1 from public.business_hours);
set local role authenticated;
do $$ declare d jsonb=current_setting('crm.holiday_fixture')::jsonb; hid uuid; pid uuid; d2 jsonb; caught boolean=false; begin
 hid=public.save_holiday(null,d,'{}');perform set_config('crm.holiday_company',hid::text,true);
 assert exists(select 1 from public.crm_holidays where id=hid and created_by_id=auth.uid() and definition->>'frequency' is null),'Create/actor/normalization';
 pid=public.save_holiday(null,d||'{"all_users":false}',array[auth.uid()]);perform set_config('crm.holiday_personal',pid::text,true);
 assert exists(select 1 from public.crm_holiday_users where holiday_id=pid and user_id=auth.uid()),'Personal association';
 begin perform public.save_holiday(pid,d||'{"all_users":false,"name":"Should not persist"}',array['c0de0000-0000-4000-8000-000000001302'::uuid]); exception when insufficient_privilege then caught=true; end; assert caught,'Cross-branch user accepted';caught=false;
 assert exists(select 1 from public.crm_holidays where id=pid and name='CODEX Holiday') and exists(select 1 from public.crm_holiday_users where holiday_id=pid and user_id=auth.uid()),'Atomic edit rollback';
 begin perform public.save_holiday(null,d||'{"all_users":false}','{}'); exception when check_violation then caught=true; end;assert caught,'Missing users accepted';caught=false;
 begin perform public.save_holiday(null,d||'{"start_date":"2026-12-02T09:00:00Z"}','{}'); exception when check_violation then caught=true; end;assert caught,'Invalid date range';caught=false;
 begin perform public.save_holiday(null,d||'{"created_by_id":"forged"}','{}'); exception when check_violation then caught=true; end;assert caught,'Forged actor';caught=false;
 d2=d||'{"is_recurring":true,"frequency":"weekly","weekly_days":["mon","fri"],"recurs_every_weeks":2}';
 perform public.save_holiday(hid,d2,'{}');assert (select definition->'weekly_days'='["mon","fri"]'::jsonb from public.crm_holidays where id=hid),'Weekly recurrence';
 begin perform public.save_holiday(hid,d2||'{"weekly_days":[]}','{}'); exception when check_violation then caught=true; end;assert caught,'Empty weekly days';caught=false;
 d2=d||'{"is_recurring":true,"frequency":"monthly","monthly_repeat_type":"day_of_month","monthly_day_of_month":10,"monthly_interval":2}';perform public.save_holiday(hid,d2,'{}');
 assert (select definition->>'monthly_interval'='2' and definition->>'recurs_every_weeks' is null from public.crm_holidays where id=hid),'Monthly normalization';
 d2=d2||'{"monthly_repeat_type":"weekday_of_month","monthly_week_of_month":2,"monthly_day_of_week":"tue"}';perform public.save_holiday(hid,d2,'{}');
 assert (select definition->>'monthly_day_of_month' is null and definition->>'monthly_interval' is null from public.crm_holidays where id=hid),'Monthly hidden fields';
 d2=d||'{"is_recurring":true,"frequency":"yearly","yearly_repeat_type":"day_of_month","yearly_day_of_month":14,"yearly_month":"july"}';perform public.save_holiday(hid,d2,'{}');
 d2=d2||'{"yearly_repeat_type":"weekday_of_month","yearly_week_of_month":3,"yearly_day_of_week":"mon"}';perform public.save_holiday(hid,d2,'{}');
 assert (select definition->>'yearly_day_of_month' is null and definition->>'yearly_day_of_week'='mon' from public.crm_holidays where id=hid),'Yearly normalization';
 begin perform public.save_holiday(hid,d2||'{"yearly_month":null}','{}'); exception when check_violation then caught=true; end;assert caught,'Missing month';caught=false;
 begin perform public.set_business_hour_holidays(array[hid,pid]); exception when insufficient_privilege then caught=true; end;assert caught,'Personal holiday linked';caught=false;
 assert not exists(select 1 from public.business_hour_holidays where holiday_id=hid),'Association batch partially persisted';
 perform public.set_business_hour_holidays(array[hid]);perform public.set_business_hour_holidays(array[hid]);
 assert (select count(*) from public.business_hour_holidays where holiday_id=hid)=1,'Duplicate link';
 assert (public.business_holiday_catalog(true,'CODEX',1)->>'count')::int=1,'Linked catalog';
 perform public.set_business_hour_holidays(array[hid],true);assert not exists(select 1 from public.business_hour_holidays where holiday_id=hid),'Remove failed';
 perform public.set_business_hour_holidays(array[hid]);
 begin update public.crm_holidays set definition='{}' where id=hid; exception when insufficient_privilege then caught=true; end;assert caught,'Raw write bypass';
end $$;
-- An unrelated branch cannot read or mutate the private holiday, even through RPC IDs.
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001302',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001302","role":"authenticated"}',true);
do $$ declare caught boolean=false; begin
 assert not exists(select 1 from public.crm_holidays where id=current_setting('crm.holiday_personal')::uuid),'Foreign read';
 assert not exists(select 1 from public.crm_holiday_users where holiday_id=current_setting('crm.holiday_personal')::uuid),'Foreign target list';
 begin perform public.delete_holiday(current_setting('crm.holiday_personal')::uuid); exception when insufficient_privilege then caught=true; end;assert caught,'Foreign delete';caught=false;
 begin perform public.save_holiday(current_setting('crm.holiday_personal')::uuid,current_setting('crm.holiday_fixture')::jsonb,'{}'); exception when insufficient_privilege then caught=true; end;assert caught,'Foreign update';
end $$;
reset role;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001301',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001301","role":"authenticated"}',true);
update public.role_permissions set is_granted=false where role_id='CODEX_HOLIDAY_TEST' and permission_id='holidays.update';
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.save_holiday(current_setting('crm.holiday_company')::uuid,current_setting('crm.holiday_fixture')::jsonb,'{}'); exception when insufficient_privilege then caught=true; end;assert caught,'Revoked update';
 perform public.delete_holiday(current_setting('crm.holiday_company')::uuid);
 assert not exists(select 1 from public.business_hour_holidays where holiday_id=current_setting('crm.holiday_company')::uuid),'Deleted holiday retained link';
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.save_holiday(uuid,jsonb,uuid[])','execute'),'Anonymous save';
 assert not has_function_privilege('anon','public.business_holiday_catalog(boolean,text,integer)','execute'),'Anonymous catalog';
end $$;
