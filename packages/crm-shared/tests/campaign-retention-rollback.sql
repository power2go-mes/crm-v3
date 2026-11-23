set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare cid uuid;lid uuid;mid uuid;begin
 select id into cid from public.campaigns limit 1;
 insert into public.accounts(name,account_owner_id) values('Readonly optional default fixture',auth.uid());
 insert into public.leads(title,first_name,last_name,email) values('Conversion member fixture','Convert','Fixture','convert@example.invalid') returning id into lid;
 insert into public.campaign_members(campaign_id,lead_id,member_status,created_by_id) values(cid,lid,'planned','c0de0000-0000-4000-8000-000000000102') returning id into mid;
 assert (select created_by_id from public.campaign_members where id=mid)=auth.uid(),'Member actor spoof accepted';
 perform public.convert_lead(lid,'create_new',null,'Member account','create_new',null,'Convert','Fixture','create_new',null,'Member opportunity');
 assert (select converted_leads_in_campaign from public.campaigns where id=cid)=1,'Conversion did not refresh member total';
 perform set_config('crm.test.retained_member',mid::text,true);
 delete from public.leads where id=lid;
end $$;
reset role;
do $$ begin
 assert exists(select 1 from public.campaign_members where id=current_setting('crm.test.retained_member')::uuid and lead_id is null and member_type='lead'),'Member history lost on Lead deletion';
 assert (select leads_in_campaign from public.campaigns c join public.campaign_members m on m.campaign_id=c.id where m.id=current_setting('crm.test.retained_member')::uuid)=1,'Historical member count differs from v2';
end $$;
