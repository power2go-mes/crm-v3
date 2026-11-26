begin;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_leads_live_created_id
  on public.leads (created_at desc, id)
  where not is_convert;

create index if not exists idx_leads_live_updated_id
  on public.leads (updated_at desc, id)
  where not is_convert;

create index if not exists idx_leads_live_owner_created_id
  on public.leads (lead_owner_id, created_at desc, id)
  where not is_convert;

create index if not exists idx_leads_live_sub_owner_created_id
  on public.leads (sub_owner_id, created_at desc, id)
  where not is_convert;

do $$
declare
  trgm_schema name;
begin
  select n.nspname
    into trgm_schema
    from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  if trgm_schema is null then
    raise exception 'pg_trgm extension is required for lead search indexes';
  end if;

  execute format(
    'create index if not exists idx_leads_title_trgm on public.leads using gin (title %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists idx_leads_company_name_trgm on public.leads using gin (company_name %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists idx_leads_first_name_trgm on public.leads using gin (first_name %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists idx_leads_last_name_trgm on public.leads using gin (last_name %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists idx_leads_email_trgm on public.leads using gin (email %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists idx_leads_phone_trgm on public.leads using gin (phone %I.gin_trgm_ops)',
    trgm_schema
  );
end;
$$;

commit;
