-- Synthetic identities only; validator always rolls back.
insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000701','import-fixture-1@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000702','import-fixture-2@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_IMPORT_TEST','Import rollback fixture',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000701','CODEX_IMPORT_TEST'),('c0de0000-0000-4000-8000-000000000702','CODEX_IMPORT_TEST');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000701',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000701","role":"authenticated"}',true);
do $$ declare denied boolean=false; begin
 begin perform public.create_lead_import('Denied','test.csv','a,b','["a","b"]','[["a","b"]]'); exception when insufficient_privilege then denied=true; end;
 assert denied,'Import feature denial bypassed';
end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) select 'CODEX_IMPORT_TEST',id,true from public.permissions where id in('imports.view','imports.create','leads.view','leads.create','leads.update');
set local role authenticated;
do $$ declare jid uuid; outcome jsonb; before_count integer; caught boolean=false; begin
 jid=public.create_lead_import('Rollback CSV','test.csv','First,Last,Email,Company,Revenue',
 '["First","Last","Email","Company","Revenue"]',
 '[["Synthetic","Import","own-import@example.invalid","Fixture Corp","12.50"],["Synthetic","","bad-import@example.invalid","Fixture Corp","-5"]]');
 perform set_config('crm.import_fixture',jid::text,true);
 outcome=public.run_lead_import(jid,'{"first_name":0,"last_name":1,"email":2,"company_name":3,"annual_revenue":4}','create','{}');
 assert (outcome->>'created_count')::integer=1 and (outcome->>'error_count')::integer=1,'Partial row import counts incorrect';
 assert exists(select 1 from public.leads where email='own-import@example.invalid' and lead_owner_id=auth.uid() and created_by_id=auth.uid() and annual_revenue=12.50),'Owner/actor or numeric value incorrect';
 assert not exists(select 1 from public.leads where email='bad-import@example.invalid'),'Failed row partially persisted';
 select count(*) into before_count from public.leads;
 perform public.run_lead_import(jid,'{"first_name":0}','create','{}');
 assert (select count(*) from public.leads)=before_count,'Completed job replayed';
 begin update public.crm_import_jobs set result='{}' where id=jid; exception when insufficient_privilege then caught=true; end;
 assert caught,'Browser forged import result';
 jid=public.create_lead_import('Update CSV','update.csv','Email,Company','["Email","Company"]','[["own-import@example.invalid","Updated Fixture"]]');
 outcome=public.run_lead_import(jid,'{"email":0,"company_name":1}','update',array['email']);
 assert (outcome->>'updated_count')::integer=1 and (outcome->>'error_count')::integer=0,'Update failed';
 assert exists(select 1 from public.leads where email='own-import@example.invalid' and company_name='Updated Fixture' and first_name='Synthetic'),'Unmapped value was overwritten';
 jid=public.create_lead_import('Bad mapping','bad.csv','First,Last','["First","Last"]','[["Synthetic","Nope"]]');
 caught=false;
 begin perform public.run_lead_import(jid,'{"lead_owner_id":0}','create','{}'); exception when check_violation then caught=true; end;
 assert caught,'Privileged field mapping accepted';
 assert (select status='ready' from public.crm_import_jobs where id=jid),'Failed configuration partially committed';
end $$;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000702',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000702","role":"authenticated"}',true);
do $$ declare jid uuid; outcome jsonb; caught boolean=false; begin
 assert not exists(select 1 from public.crm_import_jobs where id=current_setting('crm.import_fixture')::uuid),'Foreign import history exposed';
 begin perform public.run_lead_import(current_setting('crm.import_fixture')::uuid,'{"email":0}','create','{}'); exception when insufficient_privilege then caught=true; end;
 assert caught,'Foreign import execution accepted';
 jid=public.create_lead_import('Foreign update','foreign.csv','Email,Company','["Email","Company"]','[["own-import@example.invalid","Unauthorized change"]]');
 outcome=public.run_lead_import(jid,'{"email":0,"company_name":1}','update',array['email']);
 assert (outcome->>'updated_count')::integer=0 and (outcome->>'error_count')::integer=1,'Foreign matching record updated';
end $$;
reset role;
do $$ begin
 assert (select company_name='Updated Fixture' from public.leads where email='own-import@example.invalid'),'Cross-owner update persisted';
 assert not exists(select 1 from pg_roles where rolname='crm_import_executor' and (rolsuper or rolbypassrls or rolcanlogin)),'Unsafe executor role';
 assert (select relowner<>('crm_import_executor'::regrole)::oid from pg_class where oid='public.leads'::regclass),'Executor owns Leads';
 assert not has_schema_privilege('crm_import_executor','public','CREATE'),'Executor retains schema CREATE';
end $$;
-- Create permission must not silently require the separate update feature.
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000701',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000701","role":"authenticated"}',true);
do $$ declare jid uuid; outcome jsonb; begin
 jid=public.create_lead_import('Both modes','both.csv','First,Last,Email,Company','["First","Last","Email","Company"]','[["Both","Update","own-import@example.invalid","Both updated"],["Both","Create","both-new@example.invalid","Both new"]]');
 outcome=public.run_lead_import(jid,'{"first_name":0,"last_name":1,"email":2,"company_name":3}','both',array['email']);
 assert (outcome->>'created_count')::integer=1 and (outcome->>'updated_count')::integer=1 and (outcome->>'error_count')::integer=0,'Create/update combined mode failed';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_IMPORT_TEST' and permission_id='leads.update';
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000701',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000701","role":"authenticated"}',true);
do $$ declare jid uuid; outcome jsonb; begin
 jid=public.create_lead_import('Create only','create.csv','First,Last,Email,Company','["First","Last","Email","Company"]','[["Create","Only","create-only@example.invalid","Fixture Corp"]]');
 outcome=public.run_lead_import(jid,'{"first_name":0,"last_name":1,"email":2,"company_name":3}','create','{}');
 assert (outcome->>'created_count')::integer=1,'Create-only permission incorrectly requires update';
end $$;
reset role;
insert into public.crm_field_rules(definition_id,role_id,visible,editable)
 select id,'CODEX_IMPORT_TEST',true,false from public.crm_field_definitions where module='leads' and key='email';
do $$ begin assert exists(select 1 from public.crm_field_rules where role_id='CODEX_IMPORT_TEST'),'Email metadata fixture missing'; end $$;
set local role authenticated;
do $$ declare jid uuid; denied boolean=false; begin
 jid=public.create_lead_import('Readonly field','readonly.csv','Email','["Email"]','[["readonly@example.invalid"]]');
 perform set_config('crm.import_readonly',jid::text,true);
 begin perform public.run_lead_import(jid,'{"email":0}','create','{}'); exception when insufficient_privilege then denied=true; end;
 assert denied,'Readonly field mapping bypassed';
 assert (select status='ready' from public.crm_import_jobs where id=jid),'Denied field configuration wrote partial results';
end $$;
reset role;
update public.crm_field_rules set visible=false,editable=true where role_id='CODEX_IMPORT_TEST';
set local role authenticated;
do $$ declare denied boolean=false; begin
 begin perform public.run_lead_import(current_setting('crm.import_readonly')::uuid,'{"email":0}','create','{}'); exception when insufficient_privilege then denied=true; end;
 assert denied,'Hidden field mapping bypassed';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_IMPORT_TEST' and permission_id='leads.create';
set local role authenticated;
do $$ declare denied boolean=false; begin
 begin perform public.run_lead_import(current_setting('crm.import_readonly')::uuid,'{"email":0}','create','{}'); exception when insufficient_privilege then denied=true; end;
 assert denied,'Target-module create revocation bypassed';
end $$;
reset role;
