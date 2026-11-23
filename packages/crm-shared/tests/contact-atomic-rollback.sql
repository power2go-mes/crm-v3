set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare a uuid;b uuid;p uuid;c uuid;n integer; caught boolean=false; f jsonb='{"first_name":"Atomic","last_name":"Fixture","email":"atomic@example.invalid","is_primary":true}';begin
 insert into public.accounts(name,account_owner_id) values('Atomic A',auth.uid()) returning id into a;
 insert into public.accounts(name,account_owner_id) values('Atomic B',auth.uid()) returning id into b;
 p=public.save_contact_atomic(null,f,jsonb_build_array(jsonb_build_object('account_id',a),jsonb_build_object('account_id',b)));
 assert jsonb_array_length(public.contact_accounts(p))=2;
 c=public.save_contact_atomic(null,f||jsonb_build_object('parent_contact_id',p),null);
 assert exists(select 1 from public.contacts where id=c and parent_contact_id=p and is_primary);
 -- Both contacts may be primary: source defines a Contact flag, no account uniqueness.
 perform public.save_contact_atomic(p,f,jsonb_build_array(jsonb_build_object('account_id',b)));
 assert jsonb_array_length(public.contact_accounts(p))=1;
 select count(*) into n from public.contacts;
 begin perform public.save_contact_atomic(null,f,jsonb_build_array(jsonb_build_object('account_id',a),jsonb_build_object('account_id','00000000-0000-4000-8000-000000000000'))); exception when insufficient_privilege then caught=true;end;
 assert caught;assert (select count(*) from public.contacts)=n,'Failed create persisted contact';
 caught=false;
 begin perform public.save_contact_atomic(p,f||'{"first_name":"BAD"}'::jsonb,jsonb_build_array(jsonb_build_object('account_id','00000000-0000-4000-8000-000000000000')));exception when insufficient_privilege then caught=true;end;
 assert caught;assert (select first_name from public.contacts where id=p)='Atomic','Failed edit persisted fields';
 assert jsonb_array_length(public.contact_accounts(p))=1;
 caught=false;
 begin update public.contacts set parent_contact_id=c where id=p;exception when check_violation then caught=true;end;
 assert caught,'Cycle accepted';
 caught=false;
 begin update public.contacts set parent_contact_id=id where id=c;exception when check_violation then caught=true;end;
 assert caught,'Self parenting accepted';
end $$;
reset role;
