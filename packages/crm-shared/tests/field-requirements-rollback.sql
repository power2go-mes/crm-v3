-- Only synthetic metadata and identities, inside an outer rollback transaction.
insert into auth.users(id,email) values('c0de0000-0000-4000-8000-000000000601','field-requirements-fixture@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_REQUIREMENT_TEST','Requirement rollback test',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000601','CODEX_REQUIREMENT_TEST');
insert into public.crm_field_definitions(id,module,key,label,type,required,relaxable) values
 ('c0de0000-0000-4000-8000-000000000611','leads','codex_requirement_optional','Synthetic optional field','small_text',false,true),
 ('c0de0000-0000-4000-8000-000000000612','leads','codex_requirement_mandatory','Synthetic mandatory field','small_text',true,false);
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000601',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000601","role":"authenticated"}',true);
do $$ declare caught boolean=false; begin
 begin insert into public.crm_field_requirements(definition_id,required) values('c0de0000-0000-4000-8000-000000000611',true); exception when insufficient_privilege then caught=true; end;
 assert caught,'Unauthorized requirement write accepted';
end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_REQUIREMENT_TEST','settings.update',true);
set local role authenticated;
select public.crm_shared_put_definition('{"id":"c0de0000-0000-4000-8000-000000000621","module":"leads","key":"codex_edit_choice","label":"Synthetic Choice","type":"single_choice","required":false,"order":7,"choices":["A","B"]}'::jsonb);
select public.crm_shared_put_definition('{"id":"c0de0000-0000-4000-8000-000000000621","module":"leads","key":"codex_edit_choice","label":"Edited Choice","type":"single_choice","required":false,"order":8,"choices":["A","B"]}'::jsonb);
do $$ begin
 assert (select label='Edited Choice' and position=8 from public.crm_field_definitions where id='c0de0000-0000-4000-8000-000000000621'),'Custom definition edit failed';
end $$;
reset role;
-- Isolated metadata fixture for retention/type-change guard; no business record is mutated.
insert into public.crm_custom_values(module,record_id,definition_id,value) values('leads','codex-metadata-fixture','c0de0000-0000-4000-8000-000000000621','"A"'::jsonb);
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin perform public.crm_shared_put_definition('{"id":"c0de0000-0000-4000-8000-000000000621","module":"leads","key":"codex_edit_choice","label":"Edited Choice","type":"single_choice","required":false,"order":8,"choices":["B"]}'::jsonb); exception when raise_exception then caught=true; end;
 assert caught,'Existing value invalidated by choice edit';
end $$;
select public.crm_shared_delete_definition('c0de0000-0000-4000-8000-000000000621');
reset role;
do $$ begin
 assert (select archived from public.crm_field_definitions where id='c0de0000-0000-4000-8000-000000000621'),'Custom definition not archived';
 assert exists(select 1 from public.crm_custom_values where definition_id='c0de0000-0000-4000-8000-000000000621' and value='"A"'::jsonb),'Archive destroyed stored value';
end $$;
set local role authenticated;
insert into public.crm_field_requirements(definition_id,required) values('c0de0000-0000-4000-8000-000000000611',true);
update public.crm_field_requirements set required=false where definition_id='c0de0000-0000-4000-8000-000000000611';
do $$ declare caught boolean=false; begin
 assert (select required=false from public.crm_field_requirements where definition_id='c0de0000-0000-4000-8000-000000000611'),'Edit not persisted';
 begin insert into public.crm_field_requirements(definition_id,required) values('c0de0000-0000-4000-8000-000000000612',false); exception when raise_exception then caught=true; end;
 assert caught,'Nonrelaxable required field weakened';
 assert not exists(select 1 from public.crm_field_requirements where definition_id='c0de0000-0000-4000-8000-000000000612'),'Rejected requirement partially persisted';
end $$;
delete from public.crm_field_requirements where definition_id='c0de0000-0000-4000-8000-000000000611';
do $$ begin
 assert not exists(select 1 from public.crm_field_requirements where definition_id='c0de0000-0000-4000-8000-000000000611'),'Override deletion failed';
 assert (select not required from public.crm_field_definitions where id='c0de0000-0000-4000-8000-000000000611'),'Base definition changed';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_REQUIREMENT_TEST';
set local role authenticated;
do $$ declare caught boolean=false; begin
 begin insert into public.crm_field_requirements(definition_id,required) values('c0de0000-0000-4000-8000-000000000611',true); exception when insufficient_privilege then caught=true; end;
 assert caught,'Revoked settings.update still writes';
end $$;
reset role;
