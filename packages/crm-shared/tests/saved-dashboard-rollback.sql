insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000321','codex-saved-dashboard-1@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000322','codex-saved-dashboard-2@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_SAVED_DASH','Rollback saved Dashboard fixture',false,100);
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_SAVED_DASH',id,true from public.permissions where id in ('dashboard.view','dashboard.create','dashboard.update','dashboard.delete');
insert into public.user_roles(user_id,role_id) values
 ('c0de0000-0000-4000-8000-000000000321','CODEX_SAVED_DASH'),
 ('c0de0000-0000-4000-8000-000000000322','CODEX_SAVED_DASH');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000321',true);
insert into public.dashboard_folders(id,name) values('c0de0000-0000-4000-8000-000000000331','Synthetic folder');
insert into public.saved_dashboards(id,name,folder_id) values
 ('c0de0000-0000-4000-8000-000000000332','First dashboard','c0de0000-0000-4000-8000-000000000331'),
 ('c0de0000-0000-4000-8000-000000000333','Second dashboard',null);
insert into public.saved_dashboard_components(dashboard_id,name,component_type,source_id)
 values('c0de0000-0000-4000-8000-000000000332','Accounts','chart','accounts.account_type');
select public.saved_dashboard_set_default('c0de0000-0000-4000-8000-000000000332');
do $$ begin assert (select count(*) from public.saved_dashboards where is_default)=1;end $$;
select public.saved_dashboard_set_default('c0de0000-0000-4000-8000-000000000333');
do $$ begin assert (select id from public.saved_dashboards where is_default)='c0de0000-0000-4000-8000-000000000333','Default swap failed';end $$;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000322',true);
do $$ declare denied boolean=false;begin
 assert (select count(*) from public.saved_dashboards)=0,'Other user dashboard exposed';
 assert (select count(*) from public.saved_dashboard_components)=0,'Other user component exposed';
 begin perform public.saved_dashboard_set_default('c0de0000-0000-4000-8000-000000000332');exception when insufficient_privilege then denied=true;end;
 assert denied,'Foreign Dashboard default accepted';
end $$;
reset role;
delete from public.role_permissions where role_id='CODEX_SAVED_DASH' and permission_id='dashboard.update';
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000321',true);
do $$ declare denied boolean=false;begin
 begin perform public.saved_dashboard_set_default(null);exception when insufficient_privilege then denied=true;end;
 assert denied,'Editable update permission bypassed';
end $$;
reset role;
