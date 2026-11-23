-- Requires the synthetic identities/grants from leads-security-rollback.sql.
-- Execute exclusively in the validator's outer rollback transaction.
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare aid uuid; cid uuid; caught boolean=false; begin
  insert into public.accounts(name,account_owner_id) values('Synthetic contact account',auth.uid()) returning id into aid;
  insert into public.contacts(first_name,last_name,email,account_id,contact_owner_id)
    values('Synthetic','Contact','contact@example.invalid',aid,auth.uid()) returning id into cid;
  update public.contacts set title='Updated title',contact_number='12345' where id=cid;
  assert exists(select 1 from public.contacts where id=cid and title='Updated title'
    and contact_number='12345' and account_id=aid), 'Contact persistence mismatch';
  begin insert into public.contacts(first_name,last_name,contact_owner_id)
    values('Spoof','Owner','c0de0000-0000-4000-8000-000000000102');
  exception when insufficient_privilege then caught=true; end;
  assert caught, 'Foreign ownership insert accepted';
  caught=false;
  begin update public.contacts set contact_owner_id='c0de0000-0000-4000-8000-000000000102' where id=cid;
  exception when insufficient_privilege then caught=true; end;
  assert caught, 'Foreign ownership update accepted';
end $$;
reset role;
-- Remove only this synthetic user's permission; test direct API-equivalent writes.
delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000000101' and role_id='CODEX_LEADS_TEST';
set local role authenticated;
do $$ declare caught boolean=false; begin
  assert not exists(select 1 from public.contacts where email='contact@example.invalid'), 'Read without feature grant accepted';
  begin insert into public.contacts(first_name,last_name,contact_owner_id) values('Denied','Fixture',auth.uid());
  exception when insufficient_privilege then caught=true; end;
  assert caught, 'Insert without feature grant accepted';
end $$;
reset role;
