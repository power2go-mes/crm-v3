-- Run only in the validator's transaction. All identities and changes roll back.
insert into auth.users(id,email) values ('c0de0000-0000-4000-8000-000000000501','departments-fixture@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_DEPARTMENT_TEST','Department rollback test',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000501','CODEX_DEPARTMENT_TEST');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000501',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000501","role":"authenticated"}',true);
do $$ declare denied boolean=false; begin
 begin perform public.save_department(null,'CODEX department',null); exception when insufficient_privilege then denied=true; end;
 assert denied,'Missing feature grant accepted';
 assert (select count(*) from public.departments)=0,'Unpermitted read accepted';
end $$;
reset role;
-- Exercise all six canonical identities without changing their editable grants.
-- Only the synthetic identity's memberships change; actual role permissions are read.
delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000000501';
do $$ declare canonical text; expected boolean; actual boolean; begin
 for canonical in select unnest(array['SUPER_ADMIN','HEAD_OF_SALES','RSM','SSM','ASM','BDO']) loop
  insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000501',canonical);
  select exists(select 1 from public.role_permissions rp join public.roles r on r.id=rp.role_id where rp.role_id=canonical and rp.permission_id='departments.create' and rp.is_granted and r.is_active) into expected;
  set local role authenticated;
  select public.has_effective_permission(auth.uid(),'departments.create') into actual;
  assert actual=expected,'Canonical identity bypassed explicit feature grant';
  reset role;
  delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000000501';
 end loop;
end $$;
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000501','CODEX_DEPARTMENT_TEST');
insert into public.role_permissions(role_id,permission_id,is_granted) select 'CODEX_DEPARTMENT_TEST',id,true from public.permissions where module='departments';
set local role authenticated;
do $$ declare rid uuid; caught boolean=false; begin
 rid=public.save_department(null,'CODEX department',null);
 perform set_config('crm.department_fixture',rid::text,true);
 assert (select created_by_id=auth.uid() from public.departments where id=rid),'Actor mismatch';
 perform public.save_department(rid,'CODEX department edited','Description');
 assert (select description='Description' from public.departments where id=rid),'Edit not persisted';
 begin perform public.save_department(null,'CODEX department edited',null); exception when unique_violation then caught=true; end;
 assert caught,'Duplicate accepted'; caught=false;
 begin perform public.save_department(null,repeat('x',51),null); exception when check_violation then caught=true; end;
 assert caught,'Oversized name accepted'; caught=false;
 begin insert into public.departments(department_name) values('DIRECT'); exception when insufficient_privilege then caught=true; end;
 assert caught,'Raw REST mutation boundary bypassed';
 perform public.set_department_deleted(rid,true);
 assert (select deleted_at is not null from public.departments where id=rid),'Delete not persisted';
 perform public.set_department_deleted(rid,false);
 assert (select deleted_at is null from public.departments where id=rid),'Restore not persisted';
end $$;
reset role;
update public.user_profiles set department='CODEX department edited' where id='c0de0000-0000-4000-8000-000000000501';
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.set_department_deleted(current_setting('crm.department_fixture')::uuid,true); exception when foreign_key_violation then caught=true; end;
 assert caught,'User dependency was ignored'; caught=false;
 begin perform public.save_department(current_setting('crm.department_fixture')::uuid,'CODEX renamed',null); exception when foreign_key_violation then caught=true; end;
 assert caught,'Referenced label rename broke compatibility';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_DEPARTMENT_TEST' and permission_id='departments.update';
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.save_department(current_setting('crm.department_fixture')::uuid,'CODEX department edited','Denied edit'); exception when insufficient_privilege then caught=true; end;
 assert caught,'Permission revocation bypassed';
 assert (select description='Description' from public.departments where id=current_setting('crm.department_fixture')::uuid),'Denied edit partially persisted';
end $$;
reset role;
