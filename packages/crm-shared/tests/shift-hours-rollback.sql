insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000001401','shift-fixture@example.invalid'),('c0de0000-0000-4000-8000-000000001402','shift-foreign@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_SHIFT_TEST','Shift fixture',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001401','CODEX_SHIFT_TEST'),('c0de0000-0000-4000-8000-000000001402','CODEX_SHIFT_TEST');
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001401',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001401","role":"authenticated"}',true);
with pairs as(select jsonb_object_agg(day,'{"start":null,"end":null}'::jsonb) p from unnest(array['mon','tue','wed','thu','fri','sat','sun']) day), blocks as(select jsonb_build_object('mode','same','days',jsonb_build_array('mon','tue'),'start','09:00','end','17:00','per_day',p) main,jsonb_build_object('mode','none','days','[]'::jsonb,'start',null,'end',null,'per_day',p) br from pairs)
select set_config('crm.shift_fixture',jsonb_build_object('name','CODEX shift','time_zone','UTC','is_active',true,'main',main,'break1',br,'break2',br)::text,true) from blocks;
set local role authenticated;
do $$ declare caught boolean=false;begin
 begin perform public.save_shift_hours(null,current_setting('crm.shift_fixture')::jsonb,'{}');exception when insufficient_privilege then caught=true;end;assert caught,'No-feature save';
end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) select 'CODEX_SHIFT_TEST',id,true from public.permissions where module='business_hours' or id='users.view';
set local role authenticated;
do $$ declare d jsonb=current_setting('crm.shift_fixture')::jsonb; sid uuid; caught boolean=false; begin
 sid=public.save_shift_hours(null,d,array[auth.uid()]);perform set_config('crm.shift_id',sid::text,true);
 assert exists(select 1 from public.crm_shift_hours where id=sid and updated_by_id=auth.uid() and definition->'main'->'per_day'->'mon'->>'start'='09:00'),'Same mode/actor persistence';
 begin perform public.save_shift_hours(sid,d||'{"name":"Should not persist"}',array['c0de0000-0000-4000-8000-000000001402'::uuid]);exception when insufficient_privilege then caught=true;end;assert caught,'Cross-branch assigned user';caught=false;
 assert exists(select 1 from public.crm_shift_hours where id=sid and name='CODEX shift') and exists(select 1 from public.crm_shift_users where shift_id=sid and user_id=auth.uid()),'Failed edit did not roll back';
 begin perform public.save_shift_hours(sid,jsonb_set(d,'{main,end}','"08:00"'),'{}');exception when check_violation then caught=true;end;assert caught,'Overnight shift accepted';caught=false;
 begin perform public.save_shift_hours(sid,jsonb_set(d,'{main,days}','[]'),'{}');exception when check_violation then caught=true;end;assert caught,'No working days';caught=false;
 d=jsonb_set(d,'{break1}','{"mode":"same","days":["mon"],"start":"12:00","end":"13:00","per_day":{"mon":{"start":null,"end":null},"tue":{"start":null,"end":null},"wed":{"start":null,"end":null},"thu":{"start":null,"end":null},"fri":{"start":null,"end":null},"sat":{"start":null,"end":null},"sun":{"start":null,"end":null}}}');
 perform public.save_shift_hours(sid,d,array[auth.uid()]);
 begin perform public.save_shift_hours(sid,jsonb_set(d,'{break1,end}','"18:00"'),array[auth.uid()]);exception when check_violation then caught=true;end;assert caught,'Break outside shift';caught=false;
 begin perform public.save_shift_hours(sid,jsonb_set(d,'{break1,days}','["fri"]'),array[auth.uid()]);exception when check_violation then caught=true;end;assert caught,'Break on closed day';caught=false;
 -- Source validates each break independently; do not invent cross-break non-overlap rules.
 d=jsonb_set(d,'{break2}',d->'break1');perform public.save_shift_hours(sid,d,array[auth.uid()]);
 d=jsonb_set(jsonb_set(d,'{main,mode}','"different"'),'{main,per_day,wed}','{"start":"10:00","end":"16:00"}');
 d=jsonb_set(jsonb_set(d,'{break1,mode}','"different"'),'{break1,per_day,wed}','{"start":"12:00","end":"12:30"}');
 d=jsonb_set(d,'{break2,mode}','"none"');perform public.save_shift_hours(sid,d,array[auth.uid()]);
 assert (select definition->'main'->'days'='["wed"]'::jsonb and definition->'break2'->'days'='[]'::jsonb from public.crm_shift_hours where id=sid),'Different/day/none normalization';
 begin update public.crm_shift_hours set definition='{}' where id=sid;exception when insufficient_privilege then caught=true;end;assert caught,'Raw mutation bypass';
end $$;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001402',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001402","role":"authenticated"}',true);
do $$ declare caught boolean=false;begin
 assert not exists(select 1 from public.crm_shift_hours where id=current_setting('crm.shift_id')::uuid),'Foreign shift visible';
 begin perform public.delete_shift_hours(current_setting('crm.shift_id')::uuid);exception when insufficient_privilege then caught=true;end;assert caught,'Foreign delete';caught=false;
 begin perform public.save_shift_hours(current_setting('crm.shift_id')::uuid,current_setting('crm.shift_fixture')::jsonb,'{}');exception when insufficient_privilege then caught=true;end;assert caught,'Foreign reassignment';
end $$;
reset role;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001401',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001401","role":"authenticated"}',true);
select set_config('crm.shift_fill',greatest(0,50-(select count(*) from public.crm_shift_hours))::text,true);
set local role authenticated;
do $$ declare n integer; caught boolean=false;begin
 for n in 1..current_setting('crm.shift_fill')::integer loop perform public.save_shift_hours(null,current_setting('crm.shift_fixture')::jsonb||jsonb_build_object('name','CODEX capacity '||n),'{}');end loop;
 begin perform public.save_shift_hours(null,current_setting('crm.shift_fixture')::jsonb,'{}');exception when check_violation then caught=true;end;assert caught,'Company 50-shift limit bypass';
 assert jsonb_array_length(public.shift_hours_catalog(1,'CODEX')->'rows')=20,'Bounded list';
 perform public.delete_shift_hours(current_setting('crm.shift_id')::uuid);
 assert not exists(select 1 from public.crm_shift_users where shift_id=current_setting('crm.shift_id')::uuid),'Delete retained target links';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_SHIFT_TEST' and permission_id='business_hours.create';
set local role authenticated;
do $$ declare caught boolean=false;begin
 begin perform public.save_shift_hours(null,current_setting('crm.shift_fixture')::jsonb,'{}');exception when insufficient_privilege then caught=true;end;assert caught,'Revoked feature bypass';
end $$;
reset role;
do $$ begin assert not has_function_privilege('anon','public.save_shift_hours(uuid,jsonb,uuid[])','execute'),'Anonymous save';assert not has_function_privilege('authenticated','public.normalize_shift_block(jsonb,boolean)','execute'),'Internal helper exposed';end $$;
