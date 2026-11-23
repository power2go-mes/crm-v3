-- Isolated development fixture; caller MUST wrap in rollback transaction.
insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000001101','catalog-test@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_CATALOG_TEST','Catalog fixture',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001101','CODEX_CATALOG_TEST');
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000001101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000001101","role":"authenticated"}',true);
set local role authenticated;
do $$ declare denied boolean=false; begin
 begin perform public.settings_role_catalog('customer'); exception when insufficient_privilege then denied=true; end; assert denied,'Unpermitted read'; denied=false;
 begin perform public.save_settings_role('team',null,'Denied',null); exception when insufficient_privilege then denied=true; end; assert denied,'Unpermitted write';
end $$;
reset role;
-- Canonical identities retain their editable grants; there is no role-name bypass.
delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000001101';
do $$ declare canonical text; expected boolean; actual boolean; begin
 foreach canonical in array array['SUPER_ADMIN','HEAD_OF_SALES','RSM','SSM','ASM','BDO'] loop
  insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001101',canonical);
  expected=public.has_effective_permission('c0de0000-0000-4000-8000-000000001101','settings.view');
  set local role authenticated;
  actual=true;
  begin perform public.settings_role_catalog('team'); exception when insufficient_privilege then actual=false; end;
  assert actual=expected,'Canonical role bypassed effective setting permission';
  reset role;
  delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000001101';
 end loop;
end $$;
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001101','CODEX_CATALOG_TEST');
insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_CATALOG_TEST','settings.view',true);
set local role authenticated;
do $$ declare denied boolean=false; begin
 perform public.settings_role_catalog('customer');
 begin perform public.save_settings_role('partner',null,'Denied',null); exception when insufficient_privilege then denied=true; end; assert denied,'View-only write';
end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_CATALOG_TEST','settings.update',true);
set local role authenticated;
do $$ declare kind text; rid uuid; result jsonb; caught boolean=false; n integer; begin
 foreach kind in array array['customer','team','partner'] loop
  rid=public.save_settings_role(kind,null,'CODEX test role',null);
  perform public.save_settings_role(kind,rid,'CODEX edited role','Description');
  result=public.settings_role_catalog(kind,'CODEX edited',1,'description',false);
  assert (result->>'count')::int>=1 and result->'rows' @> jsonb_build_array(jsonb_build_object('id',rid,'name','CODEX edited role','description','Description')),'Round-trip failure';
  begin perform public.save_settings_role(kind,rid,repeat('x',51),null); exception when check_violation then caught=true; end; assert caught,'Oversized name'; caught=false;
  begin perform public.save_settings_role(kind,rid,' ',null); exception when check_violation then caught=true; end; assert caught,'Blank name'; caught=false;
  perform public.delete_settings_role(kind,rid);
  result=public.settings_role_catalog(kind,'CODEX edited'); assert not(result->'rows' @> jsonb_build_array(jsonb_build_object('id',rid))),'Delete failed';
 end loop;
 begin perform public.settings_role_catalog('roles;drop table public.roles'); exception when invalid_parameter_value then caught=true; end; assert caught,'Kind injection'; caught=false;
 begin perform public.settings_role_catalog('customer','',null); exception when invalid_parameter_value then caught=true; end; assert caught,'Null page'; caught=false;
 begin insert into public.team_relationship_roles(name) values('Raw'); exception when insufficient_privilege then caught=true; end; assert caught,'Raw table write';
 for n in 1..23 loop perform public.save_settings_role('team',null,'CODEX paging '||n,null); end loop;
 result=public.settings_role_catalog('team','CODEX paging',1); assert jsonb_array_length(result->'rows')=20 and (result->>'count')::int=23,'Page1';
 result=public.settings_role_catalog('team','CODEX paging',2); assert jsonb_array_length(result->'rows')=3,'Page2';
end $$;
reset role;
-- Verify installed Customer Role SET NULL behavior without deleting the association.
insert into public.contact_relationship_roles(id,name) values('c0de0000-0000-4000-8000-000000001102','CODEX linked role');
insert into public.accounts(id,name,account_owner_id) values('c0de0000-0000-4000-8000-000000001103','CODEX catalog account','c0de0000-0000-4000-8000-000000001101');
insert into public.contacts(id,first_name,last_name,contact_owner_id) values('c0de0000-0000-4000-8000-000000001104','Catalog','Fixture','c0de0000-0000-4000-8000-000000001101');
insert into public.contact_account_relationships(contact_id,account_id,role_id) values('c0de0000-0000-4000-8000-000000001104','c0de0000-0000-4000-8000-000000001103','c0de0000-0000-4000-8000-000000001102');
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.delete_settings_role('customer','c0de0000-0000-4000-8000-000000001102'); exception when foreign_key_violation then caught=true; end; assert caught,'Dependency not confirmed';
 perform public.delete_settings_role('customer','c0de0000-0000-4000-8000-000000001102',true);
end $$;
reset role;
do $$ begin assert exists(select 1 from public.contact_account_relationships where contact_id='c0de0000-0000-4000-8000-000000001104' and role_id is null),'Association destroyed'; end $$;
update public.role_permissions set is_granted=false where role_id='CODEX_CATALOG_TEST' and permission_id='settings.update';
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.save_settings_role('team',null,'Revoked',null); exception when insufficient_privilege then caught=true; end; assert caught,'Revocation bypass';
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.save_settings_role(text,uuid,text,text)','execute'),'Anonymous save';
 assert not has_function_privilege('anon','public.settings_role_catalog(text,text,integer,text,boolean)','execute'),'Anonymous read';
end $$;
