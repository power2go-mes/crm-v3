set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000101","role":"authenticated"}',true);
do $$ declare caught boolean=false;rows jsonb;begin
 begin perform public.read_module_records('accounts',null,1,null);exception when others then caught=true;end;assert caught,'Unbounded NULL page size accepted';caught=false;
 rows=public.read_module_records('accounts');assert rows->0->>'account_type'='customer_direct','Permitted field read failed';
 begin perform account_type from public.accounts;exception when insufficient_privilege then caught=true;end;assert caught,'Raw protected column accessible';
end $$;
reset role;
update public.crm_field_rules set visible=false where role_id='CODEX_LEADS_TEST' and definition_id in(select id from public.crm_field_definitions where module='accounts' and key='account_type');
set local role authenticated;
do $$ declare rows jsonb;begin
 rows=public.read_module_records('accounts');assert jsonb_array_length(rows)>0;assert not(rows->0 ? 'account_type'),'Hidden field leaked';assert rows->0 ? 'name','Visible field lost';
end $$;
reset role;
delete from public.user_roles where user_id='c0de0000-0000-4000-8000-000000000102' and role_id='SUPER_ADMIN';
set local role authenticated;
select set_config('request.jwt.claim.sub','c0de0000-0000-4000-8000-000000000102',true);
select set_config('request.jwt.claims','{"sub":"c0de0000-0000-4000-8000-000000000102","role":"authenticated"}',true);
do $$ begin assert public.read_module_records('accounts')='[]'::jsonb,'Definer reader bypassed RLS';end $$;
reset role;
