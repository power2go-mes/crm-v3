insert into public.role_permissions(role_id,permission_id,is_granted) select 'CODEX_LEADS_TEST',id,true from public.permissions where module='campaigns';
insert into public.campaigns(campaign_name,campaign_owner_id,campaign_type) values('Foreign synthetic','c0de0000-0000-4000-8000-000000000102','event');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare cid uuid;aid uuid; result jsonb;caught boolean=false;begin
 insert into public.campaigns(campaign_name,campaign_owner_id,campaign_type) values('Own synthetic',auth.uid(),'email') returning id into cid;
 assert (select status from public.campaigns where id=cid)='planned';
 assert (select count(*) from public.campaigns)=1,'Foreign campaign visible';
 result=(select jsonb_agg(g) from(select campaign_type,count(*) n from public.campaigns group by campaign_type)g);
 assert result->0->>'campaign_type'='email' and (result->0->>'n')::int=1,'Scoped aggregation mismatch';
 update public.campaigns set campaign_type='webinar' where id=cid;
 assert exists(select 1 from public.campaigns where id=cid and campaign_type='webinar');
 begin insert into public.campaigns(campaign_name,campaign_owner_id,campaign_type) values('Spoof','c0de0000-0000-4000-8000-000000000102','event');exception when insufficient_privilege then caught=true;end;assert caught,'Owner spoof accepted';
 caught=false;begin update public.campaigns set leads_in_campaign=-1 where id=cid;exception when check_violation then caught=true;end;assert caught,'Negative member counter accepted';
 caught=false;begin update public.campaigns set campaign_type='invalid' where id=cid;exception when check_violation then caught=true;end;assert caught,'Invalid type accepted';
 caught=false;begin update public.campaigns set parent_campaign_id=id where id=cid;exception when check_violation then caught=true;end;assert caught,'Self parent accepted';
 select id into aid from public.accounts limit 1;
 update public.accounts set account_type='customer_direct' where id=aid;
 update public.contacts set contact_source='web' where contact_owner_id=auth.uid();
 update public.opportunities set lead_source='social media' where owner_id=auth.uid();
 assert exists(select 1 from public.accounts where id=aid and account_type='customer_direct');
 assert exists(select 1 from public.contacts where contact_source='web');
 assert exists(select 1 from public.opportunities where lead_source='social media');
 caught=false;begin update public.contacts set contact_source='website' where contact_owner_id=auth.uid();exception when check_violation then caught=true;end;assert caught,'Wrong Contact Source choice accepted';
end $$;
reset role;
delete from public.role_permissions where role_id='CODEX_LEADS_TEST' and permission_id='campaigns.view';
set local role authenticated;
do $$ begin assert not exists(select 1 from public.campaigns),'Feature denial failed';end $$;
reset role;

insert into public.crm_field_rules(definition_id,role_id,visible,editable) select id,'CODEX_LEADS_TEST',true,false from public.crm_field_definitions where module='accounts' and key='account_type';
set local role authenticated;
do $$ declare caught boolean=false;begin
 begin update public.accounts set account_type='other';exception when insufficient_privilege then caught=true;end;assert caught,'Readonly classification write accepted';
end $$;
reset role;

do $$ begin
 assert (select type='single_choice' and required and not relaxable from public.crm_field_definitions where module='campaigns' and key='campaign_type'),'Campaign metadata requiredness mismatch';
 assert (select choices ? 'social media' and not (choices ? 'social_media') from public.crm_field_definitions where module='opportunities' and key='lead_source'),'Opportunity choice normalization corrupted';
end $$;
