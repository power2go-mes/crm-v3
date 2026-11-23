-- Runs after currency-settings-rollback.sql in the same rolled-back transaction.
reset role;
insert into public.user_roles(user_id,role_id) values('c0de0000-0000-4000-8000-000000001501','CODEX_CURRENCY_TEST');
update public.role_permissions set is_granted=true where role_id='CODEX_CURRENCY_TEST' and permission_id in ('currencies.view','currencies.update','currency_rates.view');
set local role authenticated;
do $$ declare row record;rates jsonb;result jsonb;caught boolean=false;begin
 perform public.set_multiple_currency_enabled(true);
 for row in select code from public.crm_currency_codes where code not in(select currency from public.crm_currencies) order by code limit 20 loop perform public.save_company_currency(null,row.code,'2',2);end loop;
 result=public.company_currency_page(1);
 assert jsonb_array_length(result->'rows')=20 and (result->>'row_count')::int=22,'Server Currency page1';
 result=public.company_currency_page(2);assert jsonb_array_length(result->'rows')=2,'Server Currency page2';
 assert result->'default_currency'->>'currency' is not null and jsonb_array_length(result->'configured_codes')=22,'Default/choice metadata lost';
 select jsonb_object_agg(id::text,'2'::text) into rates from public.crm_currencies where not is_default;
 perform public.save_company_exchange_rates(rates,'2028-01-01');
 result=public.company_currency_page(1,'2028-01-01');assert jsonb_array_length(result->'dated_rows')=20 and (result->>'dated_count')::int=21,'Dated server page1';
 result=public.company_currency_page(2,'2028-01-01');assert jsonb_array_length(result->'dated_rows')=1,'Dated server page2';
 begin perform public.company_currency_page(0);exception when invalid_parameter_value then caught=true;end;assert caught,'Invalid page accepted';
end $$;
reset role;
update public.role_permissions set is_granted=false where role_id='CODEX_CURRENCY_TEST' and permission_id='currency_rates.view';
set local role authenticated;
do $$ begin assert jsonb_array_length(public.company_currency_page(1,'2028-01-01')->'dated_rows')=0,'Paged dated read mask bypass';end $$;
reset role;
