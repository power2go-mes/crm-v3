-- Codex takeover: corrective Leads/conversion security. UNAPPLIED.
-- Requires 00006. No business rows, credentials or seven-stage configuration changed.
begin;
create or replace function public.has_effective_permission(p_user_id uuid,p_permission_id text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select p_user_id=auth.uid() and exists(
    select 1 from public.user_profiles u
    join public.user_roles ur on ur.user_id=u.id
    join public.roles r on r.id=ur.role_id and r.is_active
    join public.role_permissions rp on rp.role_id=r.id
    where u.id=p_user_id and u.is_active and rp.permission_id=p_permission_id and rp.is_granted
  )
$$;
revoke all on function public.has_effective_permission(uuid,text) from public,anon;
grant execute on function public.has_effective_permission(uuid,text) to authenticated;

-- Source Lead forms lock the original owner. Assignment changes sub_owner only.
create or replace function public.validate_lead_sub_owner() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null or not public.is_active_employee() then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if not public.has_effective_permission(auth.uid(),'leads.create') then
      raise exception 'Lead creation denied' using errcode='42501';
    end if;
    new.lead_owner_id=auth.uid();
    new.created_by_id=auth.uid();
  else
    if new.lead_owner_id is distinct from old.lead_owner_id
      or new.created_by_id is distinct from old.created_by_id then
      raise exception 'Lead owner and creator are immutable' using errcode='42501';
    end if;
  end if;
  if (tg_op='INSERT' and new.sub_owner_id is not null)
    or (tg_op='UPDATE' and new.sub_owner_id is distinct from old.sub_owner_id) then
    if not public.has_effective_permission(auth.uid(),'leads.update') or not exists(
      select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.is_active
      where ur.user_id=auth.uid() and ur.role_id in ('ASM','SUPER_ADMIN')
    ) then raise exception 'Only an authorized ASM may assign a BDO' using errcode='42501'; end if;
    if new.sub_owner_id is not null and not exists(
      select 1 from public.user_profiles u
      join public.user_roles ur on ur.user_id=u.id and ur.role_id='BDO'
      join public.roles r on r.id=ur.role_id and r.is_active
      where u.id=new.sub_owner_id and u.is_active
        and (exists(select 1 from public.sales_reporting_relationships s where s.user_id=u.id
          and s.manager_id=auth.uid() and s.is_active)
          or exists(select 1 from public.user_roles x where x.user_id=auth.uid() and x.role_id='SUPER_ADMIN'))
    ) then raise exception 'Choose an active directly reporting BDO' using errcode='42501'; end if;
  end if;
  if new.annual_revenue<0 or new.no_of_employees<0 then raise exception 'Values must be nonnegative'; end if;
  new.updated_at=now();
  return new;
end $$;
revoke all on function public.validate_lead_sub_owner() from public,anon,authenticated;

drop policy if exists "Create leads requires leads.create permission" on public.leads;
create policy "Create leads requires leads.create permission" on public.leads for insert to authenticated
with check(public.has_effective_permission(auth.uid(),'leads.create') and lead_owner_id=auth.uid() and created_by_id=auth.uid());
drop policy if exists "View leads within accessible sales scope" on public.leads;
create policy "View leads within accessible sales scope" on public.leads for select to authenticated using(
  public.has_effective_permission(auth.uid(),'leads.view')
  and (lead_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())) or sub_owner_id=auth.uid()));
drop policy if exists "Update leads within accessible sales scope" on public.leads;
create policy "Update leads within accessible sales scope" on public.leads for update to authenticated using(
  public.has_effective_permission(auth.uid(),'leads.update')
  and (lead_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())) or sub_owner_id=auth.uid()))
with check(public.has_effective_permission(auth.uid(),'leads.update')
  and (lead_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())) or sub_owner_id=auth.uid()));
drop policy if exists "Delete leads requires leads.delete permission" on public.leads;
create policy "Delete leads requires leads.delete permission" on public.leads for delete to authenticated using(
  public.has_effective_permission(auth.uid(),'leads.delete')
  and lead_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));

-- Conversion dependencies must enforce their own feature permissions and hierarchy.
drop policy if exists "Active employees can view accounts" on public.accounts;
drop policy if exists "Insert accounts requires accounts.create or conversion" on public.accounts;
drop policy if exists "Update accounts requires authorization" on public.accounts;
create policy accounts_scoped_read on public.accounts for select to authenticated using(
  public.has_effective_permission(auth.uid(),'accounts.view')
  and account_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));
create policy accounts_scoped_create on public.accounts for insert to authenticated with check(
  public.has_effective_permission(auth.uid(),'accounts.create')
  and account_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));
create policy accounts_scoped_update on public.accounts for update to authenticated using(
  public.has_effective_permission(auth.uid(),'accounts.update')
  and account_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())))
with check(public.has_effective_permission(auth.uid(),'accounts.update')
  and account_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));
drop policy if exists "Active employees can view contacts" on public.contacts;
drop policy if exists "Insert contacts requires authorization" on public.contacts;
drop policy if exists "Update contacts requires authorization" on public.contacts;
create policy contacts_scoped_read on public.contacts for select to authenticated using(
  public.has_effective_permission(auth.uid(),'contacts.view')
  and contact_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));
create policy contacts_scoped_create on public.contacts for insert to authenticated with check(
  public.has_effective_permission(auth.uid(),'contacts.create')
  and contact_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
  and (account_id is null or exists(select 1 from public.accounts a where a.id=account_id)));
create policy contacts_scoped_update on public.contacts for update to authenticated using(
  public.has_effective_permission(auth.uid(),'contacts.update')
  and contact_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())))
with check(public.has_effective_permission(auth.uid(),'contacts.update')
  and contact_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
  and (account_id is null or exists(select 1 from public.accounts a where a.id=account_id)));
drop policy if exists "Active employees can view opportunities" on public.opportunities;
drop policy if exists "Insert opportunities requires authorization" on public.opportunities;
drop policy if exists "Update opportunities requires authorization" on public.opportunities;
create policy opportunities_scoped_read on public.opportunities for select to authenticated using(
  public.has_effective_permission(auth.uid(),'opportunities.view')
  and owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));
create policy opportunities_scoped_create on public.opportunities for insert to authenticated with check(
  public.has_effective_permission(auth.uid(),'opportunities.create')
  and owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
  and (account_id is null or exists(select 1 from public.accounts a where a.id=account_id)));
create policy opportunities_scoped_update on public.opportunities for update to authenticated using(
  public.has_effective_permission(auth.uid(),'opportunities.update')
  and owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())))
with check(public.has_effective_permission(auth.uid(),'opportunities.update')
  and owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
  and (account_id is null or exists(select 1 from public.accounts a where a.id=account_id)));

drop policy if exists "Active employees can view lead activities" on public.lead_activities;
drop policy if exists "Active employees can insert lead activities" on public.lead_activities;
create policy lead_activity_scoped_read on public.lead_activities for select to authenticated
using(exists(select 1 from public.leads l where l.id=lead_id));
create policy lead_activity_scoped_create on public.lead_activities for insert to authenticated
with check(public.has_effective_permission(auth.uid(),'leads.update')
  and created_by_id=auth.uid() and exists(select 1 from public.leads l where l.id=lead_id));
alter table public.lead_activities alter column created_by_id set default auth.uid();
drop policy if exists "Active employees can view lead history" on public.lead_history;
create policy lead_history_scoped_read on public.lead_history for select to authenticated
using(exists(select 1 from public.leads l where l.id=lead_id));
revoke insert,update,delete on public.lead_history from anon,authenticated;
-- Trigger writer is trusted, with a pinned path; users cannot attach/call it.
alter function public.log_lead_history() set search_path=pg_catalog,public;
revoke all on function public.log_lead_history() from public,anon,authenticated;

alter table public.leads
  add column converted_account_id uuid references public.accounts(id) on delete restrict,
  add column converted_contact_id uuid references public.contacts(id) on delete restrict,
  add column converted_opportunity_id uuid references public.opportunities(id) on delete restrict;
-- Protect direct REST writes too: conversion must preserve a complete visible graph.
create function public.validate_lead_conversion_graph() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if tg_op='UPDATE' and old.is_convert and (
    not new.is_convert or new.status is distinct from old.status
    or new.converted_account_id is distinct from old.converted_account_id
    or new.converted_contact_id is distinct from old.converted_contact_id
    or new.converted_opportunity_id is distinct from old.converted_opportunity_id
  ) then raise exception 'Converted relationships are immutable' using errcode='23514'; end if;
  -- Preserve editing of legacy conversions without inventing their missing links.
  -- The immutable check above prevents changing status or attaching guessed links.
  if tg_op='UPDATE' and old.is_convert and old.converted_account_id is null
    and old.converted_contact_id is null and old.converted_opportunity_id is null then
    return new;
  end if;
  if new.is_convert or new.status='convert' then
    if not new.is_convert or new.status is distinct from 'convert'
      or new.converted_account_id is null or new.converted_contact_id is null
      or new.converted_opportunity_id is null or not exists(
        select 1 from public.accounts a
        join public.contacts c on c.account_id=a.id
        join public.opportunities o on o.account_id=a.id
        where a.id=new.converted_account_id and c.id=new.converted_contact_id
          and o.id=new.converted_opportunity_id
      ) then raise exception 'A complete authorized conversion is required' using errcode='23514'; end if;
  elsif new.converted_account_id is not null or new.converted_contact_id is not null
    or new.converted_opportunity_id is not null then
    raise exception 'Conversion links require converted status' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.validate_lead_conversion_graph() from public,anon,authenticated;
create trigger leads_conversion_graph before insert or update on public.leads
for each row execute function public.validate_lead_conversion_graph();
create table public.opportunity_contact_roles (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  is_primary boolean not null default true,
  primary key(opportunity_id,contact_id)
);
alter table public.opportunity_contact_roles enable row level security;
create policy conversion_roles_read on public.opportunity_contact_roles for select to authenticated using(
  exists(select 1 from public.opportunities o where o.id=opportunity_id)
  and exists(select 1 from public.contacts c where c.id=contact_id));
create policy conversion_roles_insert on public.opportunity_contact_roles for insert to authenticated with check(
  (public.has_effective_permission(auth.uid(),'opportunities.create') or public.has_effective_permission(auth.uid(),'opportunities.update'))
  and exists(select 1 from public.opportunities o where o.id=opportunity_id)
  and exists(select 1 from public.contacts c where c.id=contact_id));
grant select,insert on public.opportunity_contact_roles to authenticated;

-- Same signature as 00006; invoker execution makes every entity operation obey RLS.
create or replace function public.convert_lead(
  p_lead_id uuid,p_account_action text,p_account_id uuid default null,p_account_name text default null,
  p_contact_action text default 'create_new',p_contact_id uuid default null,p_contact_first_name text default null,
  p_contact_last_name text default null,p_opportunity_action text default 'create_new',p_opportunity_id uuid default null,
  p_opportunity_name text default null,p_opportunity_amount numeric default null,
  p_opportunity_close_date date default null,p_owner_id uuid default null
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare l public.leads; aid uuid; cid uuid; oid uuid; chosen_owner uuid;
begin
  if not public.has_effective_permission(auth.uid(),'leads.update') then
    raise exception 'Conversion denied' using errcode='42501';
  end if;
  select * into l from public.leads where id=p_lead_id for update;
  if not found or l.is_convert then raise exception 'Lead unavailable or already converted'; end if;
  if p_account_action not in ('create_new','select_existing') or p_account_action is null
    or p_contact_action not in ('create_new','select_existing') or p_contact_action is null
    or p_opportunity_action not in ('create_new','select_existing') or p_opportunity_action is null then
    raise exception 'Choose create new or select existing for every entity';
  end if;
  chosen_owner=coalesce(p_owner_id,l.lead_owner_id);
  if chosen_owner is null or chosen_owner not in(
    select accessible_user_id from public.get_accessible_user_ids(auth.uid())) then
    raise exception 'Owner unavailable' using errcode='42501';
  end if;
  if p_account_action='create_new' then
    if nullif(btrim(p_account_name),'') is null then raise exception 'Account name is required'; end if;
    insert into public.accounts(name,account_owner_id,contact_number,annual_revenue,industry,no_of_employees,fax,account_source)
      values(btrim(p_account_name),chosen_owner,l.phone,l.annual_revenue,l.industry,l.no_of_employees,l.fax,l.lead_source) returning id into aid;
  else
    if not public.has_effective_permission(auth.uid(),'accounts.update') then raise exception 'Link account denied' using errcode='42501'; end if;
    select id into aid from public.accounts where id=p_account_id;
    if not found then raise exception 'Account unavailable'; end if;
  end if;
  if p_contact_action='create_new' then
    if nullif(btrim(p_contact_first_name),'') is null or nullif(btrim(p_contact_last_name),'') is null then
      raise exception 'First and last names are required';
    end if;
    insert into public.contacts(account_id,first_name,last_name,email,contact_number,contact_owner_id)
      values(aid,btrim(p_contact_first_name),btrim(p_contact_last_name),l.email,l.phone,chosen_owner) returning id into cid;
  else
    update public.contacts set account_id=aid where id=p_contact_id returning id into cid;
    if not found then raise exception 'Contact unavailable'; end if;
  end if;
  if p_opportunity_action='create_new' then
    if nullif(btrim(p_opportunity_name),'') is null then raise exception 'Opportunity name is required'; end if;
    -- V2 uses ORIGINAL Lead owner for the opportunity, selected owner for account/contact.
    -- RLS deliberately rejects any resulting ownership conflict instead of bypassing scope.
    insert into public.opportunities(name,account_id,owner_id,stage,amount,close_date,probability)
      values(btrim(p_opportunity_name),aid,l.lead_owner_id,'Prospecting',p_opportunity_amount,
        coalesce(p_opportunity_close_date,(current_date+interval '1 month')::date),10) returning id into oid;
  else
    update public.opportunities set account_id=aid where id=p_opportunity_id returning id into oid;
    if not found then raise exception 'Opportunity unavailable'; end if;
  end if;
  insert into public.opportunity_contact_roles(opportunity_id,contact_id,is_primary)
    values(oid,cid,true) on conflict(opportunity_id,contact_id) do nothing;
  update public.leads set is_convert=true,status='convert',converted_account_id=aid,
    converted_contact_id=cid,converted_opportunity_id=oid where id=l.id;
  insert into public.lead_activities(lead_id,activity_type,subject,status,created_by_id)
    values(l.id,'note','Lead Converted','completed',auth.uid());
  return jsonb_build_object('success',true,'lead_id',l.id,'account_id',aid,'contact_id',cid,'opportunity_id',oid);
end $$;
revoke all on function public.convert_lead(uuid,text,uuid,text,text,uuid,text,text,text,uuid,text,numeric,date,uuid)
  from public,anon;
grant execute on function public.convert_lead(uuid,text,uuid,text,text,uuid,text,text,text,uuid,text,numeric,date,uuid)
  to authenticated;
-- Connect the existing shared engine to Leads through an invoker/RLS adapter.
create function public.crm_shared_leads_access(rid text,action text) returns boolean
language sql stable security invoker set search_path=pg_catalog,public as $$
  select action in ('view','update','export')
    and public.has_effective_permission(auth.uid(),'leads.'||action)
    and exists(select 1 from public.leads l where l.id::text=rid)
$$;
revoke all on function public.crm_shared_leads_access(text,text) from public,anon;
grant execute on function public.crm_shared_leads_access(text,text) to authenticated;
insert into public.crm_shared_modules(module,access_function)
  values('leads','public.crm_shared_leads_access(text,text)'::regprocedure)
  on conflict(module) do nothing;
insert into public.crm_field_definitions(module,key,label,type,position,is_custom)
values
 ('leads','title','Title','small_text',0,false),
 ('leads','first_name','First Name','small_text',1,false),
 ('leads','last_name','Last Name','small_text',2,false),
 ('leads','email','Email','small_text',3,false),
 ('leads','status','Lead Status','small_text',4,false),
 ('leads','lead_source','Lead Source','small_text',5,false),
 ('leads','industry','Industry','small_text',6,false),
 ('leads','annual_revenue','Annual Revenue','number',7,false)
on conflict(module,key) do nothing;
commit;
