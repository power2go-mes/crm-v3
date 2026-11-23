insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000801','codex-lead-file-asm-a@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000802','codex-lead-file-asm-b@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000803','codex-lead-file-bdo-a@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000804','codex-lead-file-bdo-b@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank) values
 ('CODEX_FILE_SCOPE','Rollback Lead file fixture',false,100);
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_FILE_SCOPE',id,true from public.permissions where id in ('leads.view','leads.create','leads.update','leads.delete');
insert into public.user_roles(user_id,role_id) values
 ('c0de0000-0000-4000-8000-000000000801','ASM'),
 ('c0de0000-0000-4000-8000-000000000802','ASM'),
 ('c0de0000-0000-4000-8000-000000000803','BDO'),
 ('c0de0000-0000-4000-8000-000000000804','BDO'),
 ('c0de0000-0000-4000-8000-000000000801','CODEX_FILE_SCOPE'),
 ('c0de0000-0000-4000-8000-000000000803','CODEX_FILE_SCOPE'),
 ('c0de0000-0000-4000-8000-000000000804','CODEX_FILE_SCOPE');
insert into public.sales_reporting_relationships(user_id,manager_id) values
 ('c0de0000-0000-4000-8000-000000000803','c0de0000-0000-4000-8000-000000000801'),
 ('c0de0000-0000-4000-8000-000000000804','c0de0000-0000-4000-8000-000000000802');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000803',true);
insert into public.leads(id,title,first_name,last_name,status,lead_source,lead_owner_id,created_by_id)
 values('c0de0000-0000-4000-8000-000000000811','Scope fixture A','Scope','A','contacted','referral',auth.uid(),auth.uid());
insert into storage.objects(bucket_id,name)
 values('lead-attachments','c0de0000-0000-4000-8000-000000000811/proof-a.txt');
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000804',true);
insert into public.leads(id,title,first_name,last_name,status,lead_source,lead_owner_id,created_by_id)
 values('c0de0000-0000-4000-8000-000000000812','Scope fixture B','Scope','B','new','website',auth.uid(),auth.uid());
insert into storage.objects(bucket_id,name)
 values('lead-attachments','c0de0000-0000-4000-8000-000000000812/proof-b.txt');
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000801',true);
do $$
begin
 assert (select count(*) from storage.objects where bucket_id='lead-attachments' and name like 'c0de0000-0000-4000-8000-00000000081%')=1,
  'Manager did not see exactly one descendant attachment';
 assert public.leads_chart_aggregate('status','count','{"stackBy":"lead_source","recordIds":["c0de0000-0000-4000-8000-000000000811","c0de0000-0000-4000-8000-000000000812"]}',false)
  ='[{"label":"Contacted","secondary":"referral","value":1}]'::jsonb,'Chart leaked a different branch or hid descendant';
 begin
  insert into storage.objects(bucket_id,name)
   values('lead-attachments','c0de0000-0000-4000-8000-000000000812/blocked.txt');
  raise exception 'Cross-branch attachment insert was accepted';
 exception when insufficient_privilege then null;
 end;
 update public.leads set sub_owner_id='c0de0000-0000-4000-8000-000000000803'
  where id='c0de0000-0000-4000-8000-000000000811';
 assert (select sub_owner_id='c0de0000-0000-4000-8000-000000000803' and lead_owner_id='c0de0000-0000-4000-8000-000000000803'
  from public.leads where id='c0de0000-0000-4000-8000-000000000811'),'Authorized BDO assignment failed or changed Lead Owner';
 begin
  update public.leads set sub_owner_id='c0de0000-0000-4000-8000-000000000804'
   where id='c0de0000-0000-4000-8000-000000000811';
  raise exception 'Cross-branch BDO assignment was accepted';
 exception when insufficient_privilege then null;
 end;
 if to_regprocedure('public.prevent_lead_delete_with_attachments()') is not null and to_regprocedure('public.lead_restore(uuid)') is null then
  begin
   delete from public.leads where id='c0de0000-0000-4000-8000-000000000811';
   raise exception 'Lead with an attachment could be deleted';
  exception when foreign_key_violation then
   assert sqlerrm = 'Remove this Lead''s attachments before deleting it.', 'Unexpected deletion guard';
  end;
 end if;
end $$;
do $$
declare note_id uuid; changed integer;
begin
 insert into public.lead_notes (lead_id,title,body)
 values ('c0de0000-0000-4000-8000-000000000811','Fixture','**text**') returning id into note_id;
 update public.lead_notes set body='*edited*' where id=note_id;
 assert found,'Scoped note edit failed';
 perform set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000804',true);
 assert not exists(select 1 from public.lead_notes where id=note_id),'Cross-branch note visible';
 delete from public.lead_notes where id=note_id;
 get diagnostics changed=row_count;
 assert changed=0,'Cross-branch note removal accepted';
 perform set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000801',true);
 delete from public.lead_notes where id=note_id;
 assert found,'Scoped note removal failed';
end $$;
reset role;
