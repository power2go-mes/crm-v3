insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000000311','codex-dashboard-stage@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_DASH_STAGE','Rollback Dashboard stage fixture',false,100);
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_DASH_STAGE',id,true from public.permissions where id in ('dashboard.view','leads.view','leads.create');
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000311','CODEX_DASH_STAGE');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000311',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000311","role":"authenticated"}',true);
insert into public.leads(title,first_name,last_name,status,lead_owner_id,created_by_id)
 values('Fixture','Dashboard','Stage','contacted',auth.uid(),auth.uid());
do $$ declare chart jsonb;begin
 select x into chart from jsonb_array_elements(public.dashboard_home_metrics()->'charts') x where x->>'id'='leads.status';
 assert chart is not null and exists(select 1 from jsonb_array_elements(chart->'data') row where row->>'label'='Contacted' and (row->>'value')::int>=1),'Lead stage label missing';
 assert not exists(select 1 from jsonb_array_elements(chart->'data') row where row->>'label'='contacted'),'Raw status ID exposed as stage';
end $$;
reset role;
