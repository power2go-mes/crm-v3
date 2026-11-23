insert into public.role_permissions(role_id,permission_id,is_granted) values('CODEX_LEADS_TEST','campaigns.view',true);
select set_config('crm.test.foreign_campaign',(select id::text from public.campaigns where campaign_owner_id='c0de0000-0000-4000-8000-000000000102' limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare cid uuid;oid uuid;caught boolean=false;begin
 select id into cid from public.campaigns limit 1;select id into oid from public.opportunities limit 1;
 update public.opportunities set primary_campaign_source_id=cid where id=oid;
 assert exists(select 1 from public.opportunities where id=oid and primary_campaign_source_id=cid),'Campaign association not persisted';
 begin update public.opportunities set primary_campaign_source_id=current_setting('crm.test.foreign_campaign')::uuid where id=oid;exception when insufficient_privilege then caught=true;end;assert caught,'Foreign Campaign association accepted';
 assert (select primary_campaign_source_id from public.opportunities where id=oid)=cid,'Failed association changed existing link';
end $$;
reset role;
