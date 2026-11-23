-- Synthetic sessions only: no refresh/access tokens are created, read or printed.
insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000001001','login-one@example.invalid'),('c0de0000-0000-4000-8000-000000001002','login-two@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_LOGIN_TEST','Login history rollback fixture',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001001','CODEX_LOGIN_TEST');
insert into auth.sessions(id,user_id,created_at,updated_at,user_agent,ip) values
 ('c0de0000-0000-4000-8000-000000001011','c0de0000-0000-4000-8000-000000001001',now(),now(),'Mozilla/5.0 (Synthetic OS) Chrome/139.0','198.51.100.1'),
 ('c0de0000-0000-4000-8000-000000001012','c0de0000-0000-4000-8000-000000001002',now(),now(),'Synthetic Other Browser','198.51.100.2');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001001',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001001","role":"authenticated"}',true);
do $$ begin assert not exists(select id from public.crm_login_history),'Missing feature grant exposed history';end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_LOGIN_TEST','login_history.view_own',true);
set local role authenticated;
do $$ declare denied boolean=false; begin
 assert exists(select id from public.crm_login_history where user_id=auth.uid() and event_type='login' and ip='198.51.100.1'),'Own session event unavailable';
 assert not exists(select id from public.crm_login_history where user_id='c0de0000-0000-4000-8000-000000001002'),'Own history feature exposed another user';
 begin perform auth_session_id from public.crm_login_history;exception when insufficient_privilege then denied=true;end;
 assert denied,'Internal session correlation exposed';denied=false;
 begin delete from public.crm_login_history where user_id=auth.uid();exception when insufficient_privilege then denied=true;end;
 assert denied,'Browser can delete login evidence';
end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_LOGIN_TEST','login_history.view_team',true),('CODEX_LOGIN_TEST','users.view',true);
set local role authenticated;
do $$ begin assert not exists(select id from public.crm_login_history where user_id='c0de0000-0000-4000-8000-000000001002'),'Team feature bypassed mandatory hierarchy scope';end $$;
reset role;
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001001','SUPER_ADMIN');
set local role authenticated;
do $$ begin assert exists(select id from public.crm_login_history where user_id='c0de0000-0000-4000-8000-000000001002'),'Explicitly permitted canonical global scope failed';end $$;
reset role;
update auth.sessions set not_after=now()+interval '1 hour' where id='c0de0000-0000-4000-8000-000000001011';
do $$ begin assert exists(select 1 from public.crm_login_history where auth_session_id='c0de0000-0000-4000-8000-000000001011' and expires_at is not null),'Session expiry update not captured';end $$;
delete from auth.sessions where id='c0de0000-0000-4000-8000-000000001011';
do $$ begin
 assert (select count(*)=2 from public.crm_login_history where auth_session_id='c0de0000-0000-4000-8000-000000001011'),'Separate login/logout events not retained';
 assert not exists(select 1 from public.crm_login_history where auth_session_id='c0de0000-0000-4000-8000-000000001011' and ended_at is null),'Ended session appears active';
 assert not has_function_privilege('authenticated','public.capture_login_history()','EXECUTE'),'Trigger writer exposed';
end $$;
delete from auth.users where id='c0de0000-0000-4000-8000-000000001002';
do $$ begin assert not exists(select 1 from public.crm_login_history where user_id='c0de0000-0000-4000-8000-000000001002'),'Auth deletion lifecycle failed';end $$;
