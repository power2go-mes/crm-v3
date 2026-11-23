begin;
-- Authenticated executor is a technical DB role, not a canonical CRM role.
-- It does not own Lead tables or bypass their RLS.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='crm_import_executor') then
  create role crm_import_executor nologin inherit nobypassrls;
 end if;
 if exists(select 1 from pg_roles where rolname='crm_import_executor' and (rolsuper or rolbypassrls or rolcanlogin)) then
  raise exception 'Unsafe import executor role';
 end if;
end $$;
grant authenticated to crm_import_executor;
-- Administrator membership permits transferring RPC ownership; not granted to API roles.
do $$ begin execute format('grant crm_import_executor to %I',current_user); end $$;
grant usage on schema public,auth to crm_import_executor;
-- Required only for ALTER FUNCTION OWNER; removed before migration completion.
grant create on schema public to crm_import_executor;
insert into public.permissions(id,module,action,description) values
 ('imports.view','imports','view','View own import history and files'),
 ('imports.create','imports','create','Run imports for explicitly permitted target modules')
on conflict(id) do nothing;
-- No automatic role grants.
create table public.crm_import_jobs(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.user_profiles(id),
 module text not null check(module='leads'),import_name varchar(100) not null check(length(btrim(import_name))>0),
 filename varchar(255) not null,source_csv text not null check(octet_length(source_csv)<=2097152),
 headers jsonb not null,rows jsonb not null,configuration jsonb,
 status text not null default 'ready' check(status in('ready','success','partial','failed')),
 result jsonb,created_at timestamptz not null default now(),completed_at timestamptz
);
create index crm_import_jobs_owner_date on public.crm_import_jobs(user_id,created_at desc,id);
alter table public.crm_import_jobs enable row level security;
create policy import_job_read on public.crm_import_jobs for select to authenticated using(
 user_id=auth.uid() and public.has_effective_permission(auth.uid(),'imports.view') and public.has_effective_permission(auth.uid(),'leads.view'));
create policy import_job_execute on public.crm_import_jobs for all to crm_import_executor using(
 user_id=auth.uid() and public.has_effective_permission(auth.uid(),'imports.create') and public.has_effective_permission(auth.uid(),'leads.create')) with check(
 user_id=auth.uid() and public.has_effective_permission(auth.uid(),'imports.create') and public.has_effective_permission(auth.uid(),'leads.create'));
revoke all on public.crm_import_jobs from public,anon,authenticated;
grant select on public.crm_import_jobs to authenticated;
grant select,insert,update on public.crm_import_jobs to crm_import_executor;

create function public.create_lead_import(p_name text,p_filename text,p_csv text,p_headers jsonb,p_rows jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare jid uuid;begin
 if not public.has_effective_permission(auth.uid(),'imports.view') or not public.has_effective_permission(auth.uid(),'imports.create')
 or not public.has_effective_permission(auth.uid(),'leads.view') or not public.has_effective_permission(auth.uid(),'leads.create') then
  raise exception 'Permission denied' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_filename is null or length(p_filename)>255 or p_filename !~* '\.csv$'
 or p_csv is null or octet_length(p_csv)>2097152 or p_headers is null or jsonb_typeof(p_headers)<>'array' or jsonb_array_length(p_headers) not between 1 and 50
 or p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 1000
 or octet_length(p_rows::text)>4194304 then raise exception 'Invalid import upload' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_headers) v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}')) not between 1 and 4000)
 or (select count(*)<>count(distinct lower(v#>>'{}')) from jsonb_array_elements(p_headers) v)
 or exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r)<>'array' or jsonb_array_length(r)<>jsonb_array_length(p_headers)) then
 raise exception 'Invalid import columns' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r cross join lateral jsonb_array_elements(r) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>4000) then
 raise exception 'Invalid import cells' using errcode='23514'; end if;
 insert into public.crm_import_jobs(module,import_name,filename,source_csv,headers,rows) values('leads',btrim(p_name),p_filename,p_csv,p_headers,p_rows) returning id into jid;
 return jid;
end $$;
alter function public.create_lead_import(text,text,text,jsonb,jsonb) owner to crm_import_executor;

create function public.run_lead_import(p_job uuid,p_mapping jsonb,p_mode text,p_match text[] default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare job public.crm_import_jobs; item jsonb; values_json jsonb; combined jsonb; existing_row jsonb; mapping record;
 idx integer; row_no integer=0; created integer=0; updated integer=0; errors jsonb='[]'; outcome jsonb; started_at timestamptz=clock_timestamp();
 cols text; fields_sql text; match_sql text; target_ids uuid[]; target_id uuid; required_field record;
 allowed text[]=array['title','first_name','last_name','email','phone','company_name','status','lead_source','industry','no_of_employees','annual_revenue','country','state','city','zip_code','fax','requirements'];
begin
 if not public.has_effective_permission(auth.uid(),'imports.view') or not public.has_effective_permission(auth.uid(),'imports.create')
 or not public.has_effective_permission(auth.uid(),'leads.view') or not public.has_effective_permission(auth.uid(),'leads.create')
 or (p_mode in('update','both') and not public.has_effective_permission(auth.uid(),'leads.update')) then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_mode is null or p_mode not in('create','update','both') or p_mapping is null or jsonb_typeof(p_mapping)<>'object' or p_mapping='{}'::jsonb
 or p_match is null or cardinality(p_match)>5 or (p_mode in('update','both') and cardinality(p_match)=0)
 or exists(select 1 from unnest(p_match) k where k is null or not(k=any(array['email','phone','first_name','last_name','company_name'])) or not(p_mapping?k))
 then raise exception 'Invalid import configuration' using errcode='23514'; end if;
 select * into job from public.crm_import_jobs where id=p_job and user_id=auth.uid() for update;
 if not found then raise exception 'Import unavailable' using errcode='42501'; end if;
 if job.completed_at is not null then return job.result; end if;
 if exists(select 1 from public.crm_field_definitions d left join public.crm_field_requirements q on q.definition_id=d.id where d.module='leads' and d.is_custom and not d.archived and coalesce(q.required,d.required)) then
  raise exception 'Required custom fields need a supported import mapping before this import can run' using errcode='23514'; end if;
 for mapping in select * from jsonb_each(p_mapping) loop
  if not(mapping.key=any(allowed)) or jsonb_typeof(mapping.value)<>'number' or (mapping.value::text)!~'^[0-9]+$' then raise exception 'Invalid mapped field' using errcode='23514'; end if;
  idx=(mapping.value::text)::integer;
  if idx>=jsonb_array_length(job.headers) then raise exception 'Invalid mapped column' using errcode='23514'; end if;
  if exists(select 1 from public.crm_field_definitions d where d.module='leads' and d.key=mapping.key and not public.crm_shared_field_access(d.id,true)) then raise exception 'Field write denied' using errcode='42501'; end if;
 end loop;
 select string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') into cols,fields_sql from jsonb_each(p_mapping);
 select string_agg(format('l.%I::text = $1->>%L',k,k),' and ') into match_sql from unnest(p_match) k;
 for item in select * from jsonb_array_elements(job.rows) loop
  row_no=row_no+1;
  begin
   values_json='{}'; existing_row=null; target_id=null;
   for mapping in select * from jsonb_each(p_mapping) loop
    if mapping.key in('annual_revenue','no_of_employees') then
     values_json=values_json || jsonb_build_object(mapping.key,nullif(btrim(item->>((mapping.value::text)::integer)),''));
    else values_json=values_json || jsonb_build_object(mapping.key,btrim(item->>((mapping.value::text)::integer))); end if;
   end loop;
   if cardinality(p_match)>0 then
    if exists(select 1 from unnest(p_match) k where coalesce(values_json->>k,'')='') then raise exception 'Blank match field' using errcode='23514'; end if;
    -- Invoker is a non-table-owner NOBYPASSRLS role inheriting authenticated.
    execute 'select array_agg(id) from (select l.id from public.leads l where '||match_sql||' limit 2) matches' into target_ids using values_json;
    if cardinality(target_ids)>1 then raise exception 'Ambiguous match' using errcode='21000'; end if;
    target_id=target_ids[1];
   end if;
   if p_mode='create' and target_id is not null then raise exception 'Duplicate match' using errcode='23505'; end if;
   if p_mode='update' and target_id is null then raise exception 'No matching record' using errcode='P0002'; end if;
   if target_id is not null and p_mode in('update','both') then
    select to_jsonb(l) into existing_row from public.leads l where id=target_id for update;
    if existing_row is null then raise exception 'Record unavailable' using errcode='42501'; end if;
   end if;
   combined=coalesce(existing_row,'{}'::jsonb)||values_json;
   if existing_row->>'is_convert'='true' then raise exception 'Converted Lead imports are not supported' using errcode='23514'; end if;
   if (values_json?'status') and (values_json->>'status'='convert' or not exists(select 1 from public.lead_statuses where id=values_json->>'status')) then raise exception 'Invalid Lead status' using errcode='23514'; end if;
   if length(coalesce(combined->>'first_name',''))>100 or length(coalesce(combined->>'last_name',''))>100 or length(coalesce(combined->>'title',''))>100
    or length(coalesce(combined->>'email',''))>254 or (coalesce(combined->>'email','')<>'' and combined->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+$')
    or (combined->>'annual_revenue')::numeric<0 or (combined->>'no_of_employees')::integer<0 then raise exception 'Invalid Lead value' using errcode='23514'; end if;
   for required_field in select d.key from public.crm_field_definitions d left join public.crm_field_requirements q on q.definition_id=d.id
     where d.module='leads' and not d.is_custom and not d.archived and coalesce(q.required,d.required) loop
    if coalesce(combined->>required_field.key,'')='' then raise exception 'Required field missing' using errcode='23514'; end if;
   end loop;
   if existing_row is null then
    if not(p_mapping?'title') then
     -- V2 Title has blank=True; preserve its verified empty-string default.
     values_json=values_json||jsonb_build_object('title','');
     execute format('insert into public.leads (title,%s) select r.title,%s from jsonb_populate_record(null::public.leads,$1) r returning id',cols,fields_sql) into target_id using values_json;
    else execute format('insert into public.leads (%s) select %s from jsonb_populate_record(null::public.leads,$1) r returning id',cols,fields_sql) into target_id using values_json; end if;
    created=created+1;
   else
    execute format('update public.leads l set (%s)=(select %s from jsonb_populate_record(null::public.leads,$1) r) where l.id=$2 returning l.id',cols,fields_sql) into target_id using values_json,target_id;
    if target_id is null then raise exception 'Record unavailable' using errcode='42501'; end if;
    updated=updated+1;
   end if;
  exception when others then
   errors=errors||jsonb_build_array(jsonb_build_object('row',row_no,'code',sqlstate,'message',case sqlstate
     when '23505' then 'Duplicate matching record.' when '21000' then 'Multiple matching records.' when 'P0002' then 'No matching record.'
     when '42501' then 'Record or field permission denied.' when '23514' then 'Required field or validation failed.'
     when '23502' then 'A required field is missing.' when '22P02' then 'Invalid field value.' else 'Row could not be imported.' end));
  end;
 end loop;
 outcome=jsonb_build_object('total_rows',row_no,'created_count',created,'updated_count',updated,'error_count',jsonb_array_length(errors),'errors',errors,'success_rate',round(100.0*(created+updated)/greatest(row_no,1),2),'duration_seconds',extract(epoch from clock_timestamp()-started_at));
 update public.crm_import_jobs set configuration=jsonb_build_object('mapping',p_mapping,'mode',p_mode,'match',p_match),result=outcome,
  status=case when jsonb_array_length(errors)=0 then 'success' when created+updated>0 then 'partial' else 'failed' end,completed_at=clock_timestamp() where id=p_job;
 return outcome;
end $$;
alter function public.run_lead_import(uuid,jsonb,text,text[]) owner to crm_import_executor;
revoke all on function public.create_lead_import(text,text,text,jsonb,jsonb),public.run_lead_import(uuid,jsonb,text,text[]) from public,anon,authenticated;
grant execute on function public.create_lead_import(text,text,text,jsonb,jsonb),public.run_lead_import(uuid,jsonb,text,text[]) to authenticated;
revoke create on schema public from crm_import_executor;
commit;
