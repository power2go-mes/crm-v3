insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_LEADS_TEST','dashboard.view',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare result jsonb;begin
 result=public.dashboard_home_metrics();
 assert (select (x->>'value')::int from jsonb_array_elements(result->'kpis') x where x->>'title'='Total Leads')=(select count(*) from public.leads where not is_convert),'Lead count mismatch';
 assert public.dashboard_home_metrics(current_date+1,current_date+2)->'kpis'->0->>'value'='0','Date filter mismatch';
 perform public.dashboard_home_layout('["leads.status","leads.lead_source"]');
 assert public.dashboard_home_layout()='["leads.status","leads.lead_source"]'::jsonb,'Layout mismatch';
 perform set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000102',true);
 assert public.dashboard_home_layout()='[]'::jsonb,'Layout crossed identities';
 perform set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
 perform public.dashboard_home_layout(null,true);assert public.dashboard_home_layout()='[]'::jsonb,'Reset mismatch';
end $$;
reset role;
insert into public.crm_field_rules(definition_id,role_id,visible,editable) select id,'CODEX_LEADS_TEST',false,false from public.crm_field_definitions where module='leads' and key='lead_source';
set local role authenticated;
do $$ begin assert not exists(select 1 from jsonb_array_elements(public.dashboard_home_metrics()->'charts') x where x->>'id'='leads.lead_source'),'Hidden field aggregated';end $$;
reset role;
delete from public.role_permissions where role_id='CODEX_LEADS_TEST' and permission_id='dashboard.view';
set local role authenticated;
do $$ declare caught boolean=false;begin
 begin perform public.dashboard_home_metrics();exception when insufficient_privilege then caught=true;end;assert caught,'Dashboard feature denial failed';
 caught=false;begin perform public.dashboard_home_layout('["attack"]');exception when insufficient_privilege then caught=true;end;assert caught,'Layout feature denial failed';
end $$;
reset role;

-- Six canonical role identities: compare RPC totals to each caller's own RLS query.
insert into auth.users(id,email) select ('c0de0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'dashboard-role-'||n||'@example.invalid' from generate_series(201,206) n;
insert into public.user_roles(user_id,role_id) select ('c0de0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r from (values(201,'SUPER_ADMIN'),(202,'HEAD_OF_SALES'),(203,'RSM'),(204,'SSM'),(205,'ASM'),(206,'BDO')) x(n,r);
set local role authenticated;
do $$ declare n integer; result jsonb; expected bigint; caught boolean;begin
 for n in 201..206 loop
 perform set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
 if public.has_effective_permission(auth.uid(),'dashboard.view') then
 result=public.dashboard_home_metrics();
 if public.has_effective_permission(auth.uid(),'leads.view') then
 select count(*) into expected from public.leads where not is_convert;
 assert (select (x->>'value')::bigint from jsonb_array_elements(result->'kpis') x where x->>'title'='Total Leads')=expected,'Canonical role aggregate exceeded RLS';
 end if;
 else
 caught=false;begin perform public.dashboard_home_metrics();exception when insufficient_privilege then caught=true;end;assert caught,'Canonical role bypassed feature denial';
 end if;
 end loop;
end $$;
reset role;
