-- Run only inside the migration validator's outer transaction, which always rolls back.
-- Synthetic identities/records only. Never commit this fixture.
insert into auth.users(id,email) values
 ('c0de0000-0000-4000-8000-000000000101','codex-leads-1@example.invalid'),
 ('c0de0000-0000-4000-8000-000000000102','codex-leads-2@example.invalid');
insert into public.roles(id,name,is_canonical,hierarchy_rank)
 values('CODEX_LEADS_TEST','Rollback-only Leads fixture',false,100);
insert into public.role_permissions(role_id,permission_id,is_granted)
 select 'CODEX_LEADS_TEST',id,true from public.permissions
 where id in ('leads.view','leads.create','leads.update','leads.delete','leads.export','recycle_bin.view','recycle_bin.restore',
 'accounts.view','accounts.create','accounts.update','contacts.view','contacts.create',
 'contacts.update','opportunities.view','opportunities.create','opportunities.update');
insert into public.user_roles(user_id,role_id) values
 ('c0de0000-0000-4000-8000-000000000101','CODEX_LEADS_TEST'),
 ('c0de0000-0000-4000-8000-000000000102','CODEX_LEADS_TEST');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare caught boolean=false; before_count integer; result jsonb; begin
  begin
    insert into public.leads(id,title,first_name,last_name,lead_owner_id,created_by_id)
     values('c0de0000-0000-4000-8000-000000000111','Fixture','Rollback','Only',
     'c0de0000-0000-4000-8000-000000000102','c0de0000-0000-4000-8000-000000000102');
  exception when insufficient_privilege then
    insert into public.leads(id,title,first_name,last_name,lead_owner_id,created_by_id)
     values('c0de0000-0000-4000-8000-000000000111','Fixture','Rollback','Only',auth.uid(),auth.uid());
  end;
  assert public.has_effective_permission(auth.uid(),'leads.create'), 'Fixture permission missing';
  assert not public.has_effective_permission('c0de0000-0000-4000-8000-000000000102','leads.create'), 'Foreign permission query accepted';
  assert exists(select 1 from public.leads where id='c0de0000-0000-4000-8000-000000000111'
    and lead_owner_id=auth.uid() and created_by_id=auth.uid()), 'Identity spoof was accepted';
  begin update public.leads set is_convert=true,status='convert' where id='c0de0000-0000-4000-8000-000000000111';
  exception when check_violation then caught=true; end;
  assert caught, 'Incomplete direct conversion accepted';
  caught=false;
  begin update public.leads set lead_owner_id='c0de0000-0000-4000-8000-000000000102'
    where id='c0de0000-0000-4000-8000-000000000111';
  exception when insufficient_privilege then caught=true; end;
  assert caught, 'Owner reassignment accepted';
  select count(*) into before_count from public.accounts;
  caught=false;
  begin perform public.convert_lead('c0de0000-0000-4000-8000-000000000111',
    'create_new',null,'Rollback account','create_new',null,'','Missing','create_new',null,'Fixture');
  exception when others then caught=true; end;
  assert caught, 'Invalid conversion accepted';
  assert (select count(*) from public.accounts)=before_count, 'Partial conversion write survived';
  assert not (select is_convert from public.leads where id='c0de0000-0000-4000-8000-000000000111');
  result=public.convert_lead('c0de0000-0000-4000-8000-000000000111',
    'create_new',null,'Rollback account','create_new',null,'Rollback','Contact','create_new',null,'Rollback opportunity',0);
  assert (result->>'success')::boolean, 'Valid conversion failed';
  assert exists(select 1 from public.leads l
    join public.accounts a on a.id=l.converted_account_id
    join public.contacts c on c.id=l.converted_contact_id and c.account_id=a.id
    join public.opportunities o on o.id=l.converted_opportunity_id and o.account_id=a.id
    join public.opportunity_contact_roles cr on cr.opportunity_id=o.id and cr.contact_id=c.id
    where l.id='c0de0000-0000-4000-8000-000000000111' and l.is_convert and o.amount=0
      and o.owner_id=l.lead_owner_id and o.stage='Prospecting'), 'Conversion graph mismatch';
  if to_regprocedure('public.lead_restore(uuid)') is not null then
    perform public.lead_archive_selected(array['c0de0000-0000-4000-8000-000000000111'::uuid]);
    assert not exists(select 1 from public.leads where id='c0de0000-0000-4000-8000-000000000111');
    perform public.lead_restore('c0de0000-0000-4000-8000-000000000111');
    assert exists(select 1 from public.leads l join public.contacts c on c.id=l.converted_contact_id
      join public.opportunities o on o.id=l.converted_opportunity_id
      where l.id='c0de0000-0000-4000-8000-000000000111' and l.is_convert
        and c.account_id=l.converted_account_id and o.account_id=l.converted_account_id), 'Restoration lost conversion links';
  end if;
  caught=false;
  begin update public.leads set is_convert=false,status='new' where id='c0de0000-0000-4000-8000-000000000111';
  exception when check_violation then caught=true; end;
  assert caught, 'Conversion reversal accepted';
  assert jsonb_array_length(public.crm_shared_metadata('leads')->'fields')=8, 'Lead metadata binding mismatch';
  perform public.crm_shared_preferences('leads','','leads_list','{"pinnedView":"recently_created"}'::jsonb);
  perform public.crm_shared_touch_record('leads','c0de0000-0000-4000-8000-000000000111');
  assert jsonb_array_length(public.crm_shared_personalization('leads')->'recent')=1, 'Recent visit persistence failed';
  assert public.crm_shared_personalization('leads')->'preferences'->0->'state'->>'pinnedView'='recently_created', 'Pinned view persistence failed';
end $$;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000102',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000102","role":"authenticated"}',true);
do $$ begin
  assert not exists(select 1 from public.leads where id='c0de0000-0000-4000-8000-000000000111'), 'Cross-owner read accepted';
  update public.leads set first_name='Attack' where id='c0de0000-0000-4000-8000-000000000111';
  assert not found, 'Cross-owner update accepted';
end $$;
reset role;
-- Editable SUPER_ADMIN permission: a missing grant must remain denied.
insert into public.user_roles(user_id,role_id)
 values('c0de0000-0000-4000-8000-000000000102','SUPER_ADMIN');
set local role authenticated;
do $$ begin
  assert not public.has_effective_permission(auth.uid(),'codex_fixture.missing'), 'SUPER_ADMIN bypass remains';
end $$;
reset role;
