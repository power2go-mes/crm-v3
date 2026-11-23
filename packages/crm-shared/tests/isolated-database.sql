-- NOT RUN during concurrent development. Destructive fixture DDL only in a disposable DB.
-- Prerequisite: base migrations 00001-00005 + Codex migration, never the shared dev DB.
-- Explicit opt-in in the SAME connection: SET crm_shared.test_database = 'isolated';
begin;
do $$ begin
  if current_setting('crm_shared.test_database',true) is distinct from 'isolated' then
    raise exception 'This integration suite requires an explicitly designated disposable database';
  end if;
end $$;
insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000001','codex-fixture-1@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000002','codex-fixture-2@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values('CODEX_FIXTURE','Codex fixture',false,100);
insert into public.permissions(id,module,action,description) values
 ('shared_fixture.view','shared_fixture','view','Fixture only'),
 ('shared_fixture.update','shared_fixture','update','Fixture only'),
 ('shared_fixture.export','shared_fixture','export','Fixture only');
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_FIXTURE',id,true from public.permissions where module='shared_fixture';
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000000001','CODEX_FIXTURE');
create table public.crm_shared_test_records(id uuid primary key,owner_id uuid not null,name text);
alter table public.crm_shared_test_records enable row level security;
create policy fixture_select on public.crm_shared_test_records for select to authenticated using(owner_id=auth.uid());
create policy fixture_update on public.crm_shared_test_records for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
grant select,update on public.crm_shared_test_records to authenticated;
create function public.crm_shared_test_access(rid text,action text) returns boolean
 language sql stable security invoker as $$
 select action in ('view','update','export') and exists(select 1 from public.crm_shared_test_records where id::text=rid)
$$;
insert into public.crm_shared_modules values('shared_fixture','public.crm_shared_test_access(text,text)'::regprocedure);
insert into public.crm_shared_test_records values
 ('c0de0000-0000-4000-8000-000000000011','c0de0000-0000-4000-8000-000000000001','Own'),
 ('c0de0000-0000-4000-8000-000000000012','c0de0000-0000-4000-8000-000000000002','Other');
insert into public.crm_field_definitions(id,module,key,label,type,required,is_custom) values
 ('c0de0000-0000-4000-8000-000000000021','shared_fixture','extra','Extra','small_text',true,true),
 ('c0de0000-0000-4000-8000-000000000022','shared_fixture','hidden','Hidden','small_text',false,true),
 ('c0de0000-0000-4000-8000-000000000023','shared_fixture','name','Name','small_text',false,false);
insert into public.crm_field_rules values('c0de0000-0000-4000-8000-000000000022','CODEX_FIXTURE',false,false);
create trigger fixture_audit after insert or update or delete on public.crm_shared_test_records
 for each row execute function public.crm_shared_capture_history('shared_fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare caught boolean=false; result jsonb; begin
  assert public.crm_shared_record_access('shared_fixture','c0de0000-0000-4000-8000-000000000011','view');
  assert not public.crm_shared_record_access('shared_fixture','c0de0000-0000-4000-8000-000000000012','view');
  begin perform public.crm_shared_save_values('shared_fixture','c0de0000-0000-4000-8000-000000000012','{"extra":"attack"}',false);
  exception when insufficient_privilege then caught=true; end;
  assert caught, 'Cross-owner write was accepted';
  caught=false;
  begin perform public.crm_shared_save_values('shared_fixture','c0de0000-0000-4000-8000-000000000011','{"hidden":"attack"}',false);
  exception when insufficient_privilege then caught=true; end;
  assert caught, 'Hidden field write was accepted';
  perform public.crm_shared_save_values('shared_fixture','c0de0000-0000-4000-8000-000000000011','{"extra":"valid"}',true);
  result=public.crm_shared_values('shared_fixture','c0de0000-0000-4000-8000-000000000011');
  assert result='{"extra":"valid"}'::jsonb, 'Value roundtrip mismatch';
  assert public.crm_shared_values('shared_fixture','c0de0000-0000-4000-8000-000000000012')='{}'::jsonb;
  caught=false;
  begin insert into public.crm_history_events(module,record_id,action,actor_id)
    values('shared_fixture','forged','create','c0de0000-0000-4000-8000-000000000002');
  exception when insufficient_privilege then caught=true; end;
  assert caught,'Audit forgery was accepted';
end $$;
update public.crm_shared_test_records set name='Changed' where id='c0de0000-0000-4000-8000-000000000011';
update public.crm_shared_test_records set name='Final' where id='c0de0000-0000-4000-8000-000000000011';
do $$ declare h jsonb; begin
  h=public.crm_shared_history('shared_fixture','c0de0000-0000-4000-8000-000000000011');
  assert jsonb_array_length(h)=1,'Duplicate transaction events';
  assert h->0->>'actor_id'='c0de0000-0000-4000-8000-000000000001','Untrusted audit actor';
  assert h::text like '%Final%' and h::text not like '%attack%','Incorrect audit values';
end $$;
rollback;
