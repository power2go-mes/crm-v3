insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000301','codex-dashboard-page-1@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000302','codex-dashboard-page-2@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_DASH_PAGE','Rollback Dashboard page fixture',false,100);
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_DASH_PAGE',id,true from public.permissions where id in ('dashboard.view','contacts.view','contacts.create','campaigns.view','leads.view');
insert into public.user_roles(user_id,role_id) values
 ('c0de0000-0000-4000-8000-000000000301','CODEX_DASH_PAGE'),
 ('c0de0000-0000-4000-8000-000000000302','CODEX_DASH_PAGE');
insert into public.crm_field_rules(definition_id,role_id,visible,editable)
 select id,'CODEX_DASH_PAGE',false,false from public.crm_field_definitions where module='leads' and key='lead_source';
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000301',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000301","role":"authenticated"}',true);
insert into public.contacts(first_name,last_name,email,contact_owner_id)
select 'Dashboard',n::text,'dashboard-page-'||n||'@example.invalid',auth.uid() from generate_series(1,12) n;
do $$ declare p jsonb;q jsonb; denied boolean=false;begin
 p=public.dashboard_home_table_page('contacts',1);
 q=public.dashboard_home_table_page('contacts',2);
 assert (p->>'total_count')::int>=12 and jsonb_array_length(p->'rows')=10 and (p->>'has_more')::boolean,'Page/count incorrect';
 assert not exists(select 1 from jsonb_array_elements(p->'rows') a join jsonb_array_elements(q->'rows') b on a->>'id'=b->>'id'),'Overlapping pages';
 p=public.dashboard_home_table_page('contacts',1,null,null,'dashboard-page-','email','asc');
 assert (p->>'total_count')::int=12 and jsonb_array_length(p->'rows')=10,'Search/count mismatch';
 p=public.dashboard_home_table_page('campaigns');
 assert (p->'columns' ? 'campaign_name') and not (p->'columns' ? 'name'),'Campaign name mismatch';
 p=public.dashboard_home_table_page('won-leads');
 assert not (p->'columns' ? 'lead_source'),'Hidden field returned';
 begin perform public.dashboard_home_table_page('won-leads',1,null,null,'','lead_source','asc');exception when insufficient_privilege then denied=true;end;
 assert denied,'Hidden field sortable';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000302',true);
do $$ begin assert not exists(select 1 from jsonb_array_elements(public.dashboard_home_table_page('contacts')->'rows') r where r->>'email' like 'dashboard-page-%@example.invalid'),'Cross-user rows leaked';end $$;
reset role;
