begin;
create function public.dashboard_home_table(widget text,page_number integer default 1,date_from date default null,date_to date default null) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare tbl text; wanted text[]; field text; selected text='id'; columns jsonb='[]'; missing jsonb='[]'; result jsonb; predicate text='';
begin
 if not public.has_effective_permission(auth.uid(),'dashboard.view') then raise exception 'Dashboard denied' using errcode='42501';end if;
 if page_number<1 or page_number>10000 or date_from>date_to then raise exception 'Invalid table request';end if;
 case widget
 when 'won-leads' then tbl='leads';wanted=array['first_name','last_name','email','lead_source'];predicate=' and is_convert';
 when 'open-leads' then tbl='leads';wanted=array['first_name','last_name','email','lead_source'];predicate=' and not is_convert';
 when 'accounts' then tbl='accounts';wanted=array['name','account_type','account_source','annual_revenue'];
 when 'contacts' then tbl='contacts';wanted=array['title','first_name','email','contact_source'];
 when 'campaigns' then tbl='campaigns';wanted=array['name','campaign_type','status'];
 when 'won-opportunities' then tbl='opportunities';wanted=array['name','amount','stage'];predicate=' and stage=''Closed Won''';
 else raise exception 'Unknown widget';end case;
 if not public.has_effective_permission(auth.uid(),tbl||'.view') then raise exception 'Module denied' using errcode='42501';end if;
 if to_regclass('public.'||tbl) is null then return jsonb_build_object('columns','[]'::jsonb,'rows','[]'::jsonb,'missing',to_jsonb(wanted),'has_more',false);end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=tbl and c.relrowsecurity) then raise exception 'Unscoped source';end if;
 foreach field in array wanted loop
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=tbl and column_name=field) then missing=missing||to_jsonb(field);
 elsif not exists(select 1 from public.crm_field_definitions d where d.module=tbl and d.key=field) or exists(select 1 from public.crm_field_definitions d where d.module=tbl and d.key=field and public.crm_shared_field_access(d.id)) then
 selected=selected||','||quote_ident(field);columns=columns||to_jsonb(field);
 end if;end loop;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from (select %s from public.%I where ($1 is null or created_at >= $1::timestamptz) and ($2 is null or created_at < ($2+1)::timestamptz)'||predicate||' order by created_at desc,id limit 11 offset $3) r',selected,tbl) into result using date_from,date_to,(page_number-1)*10;
 return jsonb_build_object('columns',columns,'rows',(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(result) with ordinality x(value,n) where n<=10),'missing',missing,'has_more',jsonb_array_length(result)>10);
end $$;
revoke all on function public.dashboard_home_table(text,integer,date,date) from public,anon;
grant execute on function public.dashboard_home_table(text,integer,date,date) to authenticated;
commit;
