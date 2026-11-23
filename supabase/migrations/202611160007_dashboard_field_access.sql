begin;
create or replace function public.dashboard_home_metrics(date_from date default null,date_to date default null) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare item record; stats jsonb='[]'; charts jsonb='[]'; groups jsonb; n bigint; clause text;
begin
 if not public.has_effective_permission(auth.uid(),'dashboard.view') then raise exception 'Dashboard denied' using errcode='42501';end if;
 if date_from>date_to then raise exception 'Invalid date range';end if;
 for item in select * from (values('accounts','Total Accounts'),('campaigns','Total Campaigns'),('contacts','Total Contacts'),('leads','Total Leads'),('opportunities','Total Opportunities')) v(tbl,label) loop
 if public.has_effective_permission(auth.uid(),item.tbl||'.view') and to_regclass('public.'||item.tbl) is not null then
 if not exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=item.tbl and c.relrowsecurity) then raise exception 'Unscoped metric source';end if;
 clause=case when item.tbl='leads' then ' and not is_convert' else '' end;
 execute format('select count(*) from public.%I where ($1 is null or created_at >= $1::timestamptz) and ($2 is null or created_at < ($2+1)::timestamptz)'||clause,item.tbl) into n using date_from,date_to;
 stats=stats||jsonb_build_array(jsonb_build_object('title',item.label,'value',n));
 end if;end loop;
 for item in select * from (values('leads','lead_source','Leads by Source','funnel'),('leads','status','Leads by Stage','bar'),('accounts','account_type','Accounts by Account Type','pie'),('campaigns','campaign_type','Campaigns by Type','donut'),('opportunities','lead_source','Opportunities by Lead Source','bar')) v(tbl,col,title,kind) loop
 if public.has_effective_permission(auth.uid(),item.tbl||'.view') then
 if exists(select 1 from public.crm_field_definitions d where d.module=item.tbl and d.key=item.col) and not exists(select 1 from public.crm_field_definitions d where d.module=item.tbl and d.key=item.col and public.crm_shared_field_access(d.id)) then continue;end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=item.tbl and column_name=item.col) then
 charts=charts||jsonb_build_array(jsonb_build_object('id',item.tbl||'.'||item.col,'title',item.title,'kind',item.kind,'status','schema_missing','data','[]'::jsonb));
 else
 if not exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=item.tbl and c.relrowsecurity) then raise exception 'Unscoped chart source';end if;
 clause=case when item.tbl='leads' then ' and not is_convert' else '' end;
 execute format('select coalesce(jsonb_agg(to_jsonb(g)),''[]'') from (select coalesce(nullif(%I::text,''''),''Unknown'') label,count(*) value from public.%I where ($1 is null or created_at >= $1::timestamptz) and ($2 is null or created_at < ($2+1)::timestamptz)'||clause||' group by 1 order by 2 desc,1 limit 200) g',item.col,item.tbl) into groups using date_from,date_to;
 charts=charts||jsonb_build_array(jsonb_build_object('id',item.tbl||'.'||item.col,'title',item.title,'kind',item.kind,'status','ready','data',groups));
 end if;end if;end loop;
 return jsonb_build_object('kpis',stats,'charts',charts);
end $$;
commit;
