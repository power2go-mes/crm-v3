insert into public.role_permissions(role_id,permission_id,is_granted) select 'CODEX_LEADS_TEST',id,true from public.permissions where module='campaigns';
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000102',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000102","role":"authenticated"}',true);
insert into public.leads(id,title,first_name,last_name) values('c0de0000-0000-4000-8000-000000000298','Foreign scope fixture','Foreign','Fixture');
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare cid uuid;caught boolean=false;begin
 assert not exists(select 1 from public.leads where id='c0de0000-0000-4000-8000-000000000298'),'Test requires an inaccessible target';
 insert into public.campaigns(campaign_name,campaign_owner_id,campaign_type) values('Target-scope fixture',auth.uid(),'email') returning id into cid;
 begin insert into public.campaign_members(campaign_id,member_type,lead_id,member_status) values(cid,'lead','c0de0000-0000-4000-8000-000000000298','planned');exception when insufficient_privilege then caught=true;end;
 assert caught,'P0: Installed Campaign member policy accepted an inaccessible Lead';
 insert into public.campaign_members(campaign_id,member_type,lead_id,member_status) values(cid,'lead','c0de0000-0000-4000-8000-000000000111','planned');
 assert exists(select 1 from public.campaign_members where campaign_id=cid and lead_id='c0de0000-0000-4000-8000-000000000111'),'Allowed member rejected';
end $$;
reset role;
