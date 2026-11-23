begin;
create function public.company_currency_page(p_page integer default 1,p_date date default null) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare data jsonb; currencies jsonb; dated jsonb;begin
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid Currency page' using errcode='22023';end if;
 -- Shared authorization, date selection and bounded configuration logic remain authoritative.
 data=public.company_currency_catalog(p_date);currencies=data->'rows';dated=data->'dated_rows';
 data=data||jsonb_build_object('row_count',jsonb_array_length(currencies),'dated_count',jsonb_array_length(dated),
 'other_count',(select count(*) from jsonb_array_elements(currencies) c where c->>'is_default'='false'),
 'configured_codes',(select coalesce(jsonb_agg(c->>'currency'),'[]') from jsonb_array_elements(currencies) c),
 'default_currency',(select c from jsonb_array_elements(currencies) c where c->>'is_default'='true' limit 1));
 data=jsonb_set(data,'{rows}',coalesce((select jsonb_agg(c.value order by c.ordinality) from jsonb_array_elements(currencies) with ordinality c where c.ordinality>(p_page-1)*20 and c.ordinality<=p_page*20),'[]'));
 data=jsonb_set(data,'{dated_rows}',coalesce((select jsonb_agg(c.value order by c.ordinality) from jsonb_array_elements(dated) with ordinality c where c.ordinality>(p_page-1)*20 and c.ordinality<=p_page*20),'[]'));
 return data;
end $$;
revoke all on function public.company_currency_page(integer,date) from public,anon;
grant execute on function public.company_currency_page(integer,date) to authenticated;
commit;
