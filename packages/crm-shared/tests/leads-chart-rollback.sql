insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000000411','codex-leads-chart@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_LEADS_CHART','Rollback Leads chart fixture',false,100);
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_LEADS_CHART',id,true from public.permissions where id in ('leads.view','leads.create');
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000411','CODEX_LEADS_CHART');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000411',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000411","role":"authenticated"}',true);
insert into public.leads(title,first_name,last_name,status,lead_source,industry,annual_revenue,lead_owner_id,created_by_id)
 values('Fixture','Lead','Chart','contacted','referral','healthcare',800,auth.uid(),auth.uid());
do $$ declare chart jsonb;begin
 chart:=public.leads_chart_aggregate('status','count','{}',false);
 assert exists(select 1 from jsonb_array_elements(chart) row where row->>'label'='Contacted' and (row->>'value')::int>=1),'Stage aggregate missing fixture';
 chart:=public.leads_chart_aggregate('lead_source','annual_revenue_sum','{"source":["referral"]}',false);
 assert exists(select 1 from jsonb_array_elements(chart) row where row->>'label'='referral' and (row->>'value')::numeric>=800),'Source sum missing fixture';
 chart:=public.leads_chart_aggregate('status','count','{"source":["nonexistent"]}',false);
 assert chart='[]'::jsonb,'Filter ignored';
 begin perform public.leads_chart_aggregate('bad_field','count','{}',false);raise exception 'Invalid dimension accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000000412','codex-leads-chart-denied@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000412',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000412","role":"authenticated"}',true);
do $$ begin
 begin perform public.leads_chart_aggregate();raise exception 'Unauthorized chart accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
