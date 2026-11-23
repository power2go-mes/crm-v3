insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_LEADS_TEST','campaigns.view',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare cid uuid;lid uuid;tid uuid;mid uuid;caught boolean=false;begin
 select id into cid from public.campaigns limit 1;select id into lid from public.leads limit 1;select id into tid from public.contacts limit 1;
 insert into public.campaign_members(campaign_id,lead_id,member_status) values(cid,lid,'responded') returning id into mid;
 insert into public.campaign_members(campaign_id,contact_id,member_type,member_status) values(cid,tid,'contact','planned');
 assert exists(select 1 from public.campaigns where id=cid and leads_in_campaign=1 and contacts_in_campaign=1 and responses_in_campaign=1 and converted_leads_in_campaign=1),'Counters incorrect';
 begin insert into public.campaign_members(campaign_id,lead_id,member_status) values(cid,lid,'sent');exception when unique_violation then caught=true;end;assert caught,'Duplicate member accepted';
 update public.campaign_members set member_status='sent' where id=mid;
 assert (select responses_in_campaign from public.campaigns where id=cid)=0,'Response decrement failed';
 delete from public.campaign_members where id=mid;
 assert exists(select 1 from public.campaigns where id=cid and leads_in_campaign=0 and contacts_in_campaign=1),'Removal affected other members';
 caught=false;begin insert into public.campaign_members(campaign_id,lead_id,member_status) values(cid,'00000000-0000-4000-8000-000000000000','sent');exception when insufficient_privilege or foreign_key_violation then caught=true;end;assert caught,'Foreign member accepted';
end $$;
reset role;
