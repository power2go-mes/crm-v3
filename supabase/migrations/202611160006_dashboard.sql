begin;
create table public.dashboard_home_layouts(user_id uuid primary key default auth.uid() references public.user_profiles(id) on delete cascade,widget_order jsonb not null default '[]' check(jsonb_typeof(widget_order)='array' and jsonb_array_length(widget_order)<=30));
alter table public.dashboard_home_layouts enable row level security;
create policy dashboard_layout_owner on public.dashboard_home_layouts for all to authenticated using(user_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.view')) with check(user_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.view'));
grant select,insert,update,delete on public.dashboard_home_layouts to authenticated;
create function public.dashboard_home_layout(order_ids jsonb default null,reset_layout boolean default false) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not public.has_effective_permission(auth.uid(),'dashboard.view') then raise exception 'Dashboard denied' using errcode='42501';end if;
 if reset_layout then delete from public.dashboard_home_layouts where user_id=auth.uid();
 elsif order_ids is not null then
 if jsonb_typeof(order_ids)<>'array' or jsonb_array_length(order_ids)>30 or exists(select 1 from jsonb_array_elements(order_ids) x where jsonb_typeof(x)<>'string') or (select count(*)<>count(distinct x) from jsonb_array_elements(order_ids) x) then raise exception 'Invalid layout';end if;
 insert into public.dashboard_home_layouts(widget_order) values(order_ids) on conflict(user_id) do update set widget_order=excluded.widget_order;
 end if;
 select widget_order into result from public.dashboard_home_layouts where user_id=auth.uid();return coalesce(result,'[]');
end $$;
create function public.dashboard_home_metrics(date_from date default null,date_to date default null) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
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
revoke all on function public.dashboard_home_metrics(date,date),public.dashboard_home_layout(jsonb,boolean) from public,anon;
grant execute on function public.dashboard_home_metrics(date,date),public.dashboard_home_layout(jsonb,boolean) to authenticated;
commit;
