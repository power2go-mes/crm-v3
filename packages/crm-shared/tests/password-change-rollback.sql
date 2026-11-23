-- Synthetic auth rows only. Never call provider password endpoints in this fixture.
insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000000901','password-one@example.invalid'),('c0de0000-0000-4000-8000-000000000902','password-two@example.invalid');
do $$ begin assert not exists(select 1 from public.user_password_changes where user_id in('c0de0000-0000-4000-8000-000000000901','c0de0000-0000-4000-8000-000000000902')),'Unverified initial timestamp invented'; end $$;
update auth.users set encrypted_password='synthetic-fixture-marker-only' where id='c0de0000-0000-4000-8000-000000000901';
update auth.users set encrypted_password='synthetic-other-fixture-marker-only' where id='c0de0000-0000-4000-8000-000000000902';
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000901',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000901","role":"authenticated"}',true);
do $$ declare denied boolean=false; begin
 assert exists(select 1 from public.user_password_changes where user_id=auth.uid()),'Own timestamp unavailable';
 assert not exists(select 1 from public.user_password_changes where user_id='c0de0000-0000-4000-8000-000000000902'),'Foreign password timestamp exposed';
 begin update public.user_password_changes set changed_at=now() where user_id=auth.uid(); exception when insufficient_privilege then denied=true; end;
 assert denied,'Browser can forge last-change timestamp';
end $$;
select set_config('crm.password_stamp',(select changed_at::text from public.user_password_changes where user_id=auth.uid()),true);
reset role;
update auth.users set raw_user_meta_data='{"synthetic":true}',encrypted_password='synthetic-fixture-marker-only' where id='c0de0000-0000-4000-8000-000000000901';
do $$ begin
 assert (select changed_at::text=current_setting('crm.password_stamp') from public.user_password_changes where user_id='c0de0000-0000-4000-8000-000000000901'),'Unrelated/same-password update changed password history';
 assert not has_function_privilege('authenticated','public.capture_password_change_timestamp()','EXECUTE'),'Trigger-only writer exposed as RPC';
 assert (select count(*)=2 from information_schema.columns where table_schema='public' and table_name='user_password_changes'),'Password tracking schema unexpectedly stores more than actor and timestamp';
end $$;
