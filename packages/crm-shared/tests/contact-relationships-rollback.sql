insert into public.contact_relationship_roles(id,name) values('c0de0000-0000-4000-8000-000000000199','Synthetic role');
insert into public.accounts(id,name,account_owner_id) values('c0de0000-0000-4000-8000-000000000198','Foreign fixture','c0de0000-0000-4000-8000-000000000102');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare a uuid; b uuid; c uuid; caught boolean=false; begin
 insert into public.accounts(name,account_owner_id) values('Relation fixture A',auth.uid()) returning id into a;
 insert into public.accounts(name,account_owner_id) values('Relation fixture B',auth.uid()) returning id into b;
 insert into public.contacts(first_name,last_name,contact_owner_id,account_id) values('Relation','Fixture',auth.uid(),a) returning id into c;
 perform public.set_contact_account(c,a);
 perform public.set_contact_account(c,b,'c0de0000-0000-4000-8000-000000000199');
 assert exists(select 1 from public.contact_account_relationships where contact_id=c and account_id=b and role_id='c0de0000-0000-4000-8000-000000000199');
 assert jsonb_array_length(public.contact_accounts(c))=2;
 begin perform public.set_contact_account(c,b,'00000000-0000-4000-8000-000000000000'); exception when foreign_key_violation then caught=true; end;
 assert caught, 'Invalid role accepted';
 assert exists(select 1 from public.contact_account_relationships where contact_id=c and account_id=b and role_id='c0de0000-0000-4000-8000-000000000199'), 'Failed role write changed relationship';
 caught=false;
 perform public.set_contact_account(c,b); -- upsert cannot duplicate the pair
 assert jsonb_array_length(public.contact_accounts(c))=2;
 perform public.set_contact_account(c,b,null,true);
 assert jsonb_array_length(public.contact_accounts(c))=1;
 assert exists(select 1 from public.contacts where id=c and account_id=a);
 begin perform public.set_contact_account(c,a,null,true); exception when others then caught=true; end;
 assert caught, 'Legacy link removal accepted';
 caught=false;
 begin perform public.set_contact_account(c,'c0de0000-0000-4000-8000-000000000198'); exception when insufficient_privilege then caught=true; end;
 assert caught, 'Unavailable account accepted';
end $$;
reset role;
