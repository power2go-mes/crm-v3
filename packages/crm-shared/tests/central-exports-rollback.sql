-- Synthetic authenticated identities only, always enclosed by validator rollback.
insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000801','export-one@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000802','export-two@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_EXPORT_TEST','Export rollback fixture',false,100);
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000801','CODEX_EXPORT_TEST'),('c0de0000-0000-4000-8000-000000000802','CODEX_EXPORT_TEST');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000801',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000801","role":"authenticated"}',true);
do $$ begin assert not public.has_effective_permission(auth.uid(),'exports.view'),'Missing export feature grant bypassed'; end $$;
reset role;
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_EXPORT_TEST',id,true from public.permissions where id='exports.view' or (module in('leads','accounts','contacts','opportunities','campaigns') and action in('view','export','create','update'));
set local role authenticated;
insert into public.leads(id,title,first_name,last_name,email) values('c0de0000-0000-4000-8000-000000000811','','Export','Lead','export-fixture@example.invalid');
insert into public.accounts(id,name,account_owner_id) values('c0de0000-0000-4000-8000-000000000812','Export Account',auth.uid());
select set_config('crm.export_contact',public.save_contact_atomic(null,'{"first_name":"Export","last_name":"Contact","email":"export-contact@example.invalid"}', '[]')::text,true);
insert into public.opportunities(id,name,account_id,owner_id,close_date) values('c0de0000-0000-4000-8000-000000000814','Export Opportunity','c0de0000-0000-4000-8000-000000000812',auth.uid(),'2026-12-31');
insert into public.campaigns(id,campaign_name,campaign_type,campaign_owner_id) values('c0de0000-0000-4000-8000-000000000815','Export Campaign','email',auth.uid());
do $$ declare m text; begin
 foreach m in array array['leads','accounts','contacts','opportunities','campaigns'] loop
  assert public.has_effective_permission(auth.uid(),m||'.view') and public.has_effective_permission(auth.uid(),m||'.export'),'Module export feature not resolved';
 end loop;
 assert exists(select 1 from public.leads where id='c0de0000-0000-4000-8000-000000000811');
 assert exists(select 1 from public.accounts where id='c0de0000-0000-4000-8000-000000000812');
 assert exists(select 1 from public.contacts where id=current_setting('crm.export_contact')::uuid);
 assert exists(select 1 from public.opportunities where id='c0de0000-0000-4000-8000-000000000814');
 assert exists(select 1 from public.campaigns where id='c0de0000-0000-4000-8000-000000000815');
end $$;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000802',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000802","role":"authenticated"}',true);
do $$ begin
 assert not exists(select 1 from public.leads where id='c0de0000-0000-4000-8000-000000000811'),'Foreign Lead visible';
 assert not exists(select 1 from public.accounts where id='c0de0000-0000-4000-8000-000000000812'),'Foreign Account visible';
 assert not exists(select 1 from public.contacts where id=current_setting('crm.export_contact')::uuid),'Foreign Contact visible';
 assert not exists(select 1 from public.opportunities where id='c0de0000-0000-4000-8000-000000000814'),'Foreign Opportunity visible';
 assert not exists(select 1 from public.campaigns where id='c0de0000-0000-4000-8000-000000000815'),'Foreign Campaign visible';
end $$;
reset role;
insert into public.crm_field_rules(definition_id,role_id,visible,editable)
 select id,'CODEX_EXPORT_TEST',false,false from public.crm_field_definitions where module='accounts' and key='account_type';
set local role authenticated;
do $$ begin
 assert not exists(select 1 from jsonb_array_elements(public.crm_shared_metadata('accounts')->'fields') f where f->>'key'='account_type'),'Hidden classification remained export-visible';
end $$;
reset role;
update public.crm_field_rules set visible=true,editable=false where role_id='CODEX_EXPORT_TEST';
set local role authenticated;
do $$ begin
 assert exists(select 1 from jsonb_array_elements(public.crm_shared_metadata('accounts')->'fields') f where f->>'key'='account_type' and f->>'access'='readonly'),'Readonly readable classification disappeared';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_EXPORT_TEST' and permission_id='accounts.export';
set local role authenticated;
do $$ begin assert not public.has_effective_permission(auth.uid(),'accounts.export'),'Revoked export grant retained'; end $$;
reset role;
