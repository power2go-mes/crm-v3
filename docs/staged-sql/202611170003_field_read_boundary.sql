-- STAGED / UNAPPLIED: consumer cutover, including Dashboard-owned invoker
-- aggregates, must be coordinated before these column revocations go live.
begin;
create role crm_masked_reader nologin inherit nobypassrls;
grant authenticated to crm_masked_reader;
grant usage on schema public to crm_masked_reader;
grant select on public.accounts,public.contacts,public.opportunities,public.campaigns to crm_masked_reader;
revoke select on public.accounts,public.contacts,public.opportunities,public.campaigns from public,anon,authenticated;
do $$ declare t text; protected text; cols text;begin
 for t,protected in select * from (values('accounts','account_type'),('contacts','contact_source'),('opportunities','lead_source'),('campaigns','campaign_type')) v(t,p) loop
 select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t and column_name<>protected;
 execute format('grant select (%s) on public.%I to authenticated',cols,t);
 end loop;
end $$;
create function public.read_module_records(m text,rid uuid default null,page_number integer default 1,page_size integer default 20) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare rows jsonb; row_data jsonb; result jsonb='[]'; f record;
begin
 if m is null or page_number is null or page_size is null or m not in ('accounts','contacts','opportunities','campaigns') or page_number<1 or page_number>10000 or page_size<1 or page_size>100 then raise exception 'Invalid read request';end if;
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),m||'.view') then raise exception 'Read denied' using errcode='42501';end if;
 -- The function owner is a non-table-owner, NOLOGIN, NOBYPASSRLS role.
 -- It inherits authenticated policies; JWT identity remains the caller's.
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from (select * from public.%I where ($1 is null or id=$1) order by id limit $2 offset $3) r',m) into rows using rid,page_size,(page_number-1)*page_size;
 for row_data in select value from jsonb_array_elements(rows) loop
 for f in select id,key from public.crm_field_definitions where module=m loop
 if not public.crm_shared_field_access(f.id) then row_data=row_data-f.key;end if;
 end loop;
 result=result||jsonb_build_array(row_data);
 end loop;
 return result;
end $$;
-- PostgreSQL requires schema CREATE permission while transferring ownership.
grant create on schema public to crm_masked_reader;
grant crm_masked_reader to postgres;
alter function public.read_module_records(text,uuid,integer,integer) owner to crm_masked_reader;
revoke create on schema public from crm_masked_reader;
revoke all on function public.read_module_records(text,uuid,integer,integer) from public,anon;
grant execute on function public.read_module_records(text,uuid,integer,integer) to authenticated;
commit;
