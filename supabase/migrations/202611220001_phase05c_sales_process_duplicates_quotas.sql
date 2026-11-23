-- =============================================================================
-- FINLONEXA CRM v3 — Migration 202611220001: Phase 05C
-- Sales Process Improvements, Duplicate Management & Sales Performance
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. PERMISSIONS SETUP
-- -----------------------------------------------------------------------------
insert into public.permissions (id, module, action, description)
values
  ('sales_targets.view', 'sales_targets', 'view', 'View sales quotas and performance targets'),
  ('sales_targets.manage', 'sales_targets', 'manage', 'Create, update, and manage sales targets and quotas'),
  ('data_quality.manage', 'data_quality', 'manage', 'Manage duplicate rules, scan duplicates, and merge records')
on conflict (id) do nothing;

-- Grant permissions to SUPER_ADMIN and HEAD_OF_SALES
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join (
  values
    ('sales_targets.view'),
    ('sales_targets.manage'),
    ('data_quality.manage')
) as p(id)
where r.name in ('SUPER_ADMIN', 'HEAD_OF_SALES')
on conflict do nothing;

-- Grant view permissions to management tiers
insert into public.role_permissions (role_id, permission_id)
select r.id, 'sales_targets.view'
from public.roles r
where r.name in ('RSM', 'SSM', 'ASM', 'BDO')
on conflict do nothing;


-- -----------------------------------------------------------------------------
-- 1. WORKSTREAM A: CLOSED LOST REASON & COMPETITOR TRACKING
-- -----------------------------------------------------------------------------

-- Alter opportunities table with lost reason, competitor, and closing audit fields
alter table public.opportunities
  add column if not exists lost_reason text,
  add column if not exists lost_reason_details text,
  add column if not exists competitor_name text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by_id uuid references public.user_profiles(id) on delete set null;

-- Add check constraint on lost_reason if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'opportunities_lost_reason_check' and conrelid = 'public.opportunities'::regclass
  ) then
    alter table public.opportunities
      add constraint opportunities_lost_reason_check
      check (
        lost_reason is null
        or lost_reason in ('price', 'competitor', 'missing_features', 'unresponsive', 'budget', 'cancelled', 'timing', 'other')
        or btrim(lost_reason) <> ''
      );
  end if;
end $$;

-- Loss History audit table for tracking multiple close/reopen cycles
create table if not exists public.crm_opportunity_loss_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  lost_reason text not null,
  lost_reason_details text,
  competitor_name text,
  closed_at timestamptz not null default now(),
  closed_by_id uuid references public.user_profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by_id uuid references public.user_profiles(id) on delete set null,
  reopen_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_opp_loss_history_opp_id
  on public.crm_opportunity_loss_history(opportunity_id);

-- -----------------------------------------------------------------------------
-- 2. WORKSTREAM C: OPPORTUNITY PROCESS IMPROVEMENTS (NEXT STEP, AGING, STALLED)
-- -----------------------------------------------------------------------------

alter table public.opportunities
  add column if not exists next_step text,
  add column if not exists next_activity_date timestamptz,
  add column if not exists stage_entered_at timestamptz not null default now();

-- Trigger to maintain stage_entered_at, closed_at, and loss tracking
create or replace function public.trg_opportunity_stage_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- 1. Track stage entry timestamp whenever stage changes
  if TG_OP = 'INSERT' then
    new.stage_entered_at := coalesce(new.stage_entered_at, now());
  elsif TG_OP = 'UPDATE' and old.stage is distinct from new.stage then
    new.stage_entered_at := now();
  end if;

  -- 2. Transitioning to Closed Lost
  if new.stage = 'closed_lost' then
    if new.lost_reason is null or btrim(new.lost_reason) = '' then
      raise exception 'A valid Closed Lost reason is mandatory when closing an opportunity as lost.'
        using errcode = '22023';
    end if;

    new.closed_at := coalesce(new.closed_at, now());
    if auth.uid() is not null and new.closed_by_id is null then
      new.closed_by_id := auth.uid();
    end if;

    -- Record loss event in history
    insert into public.crm_opportunity_loss_history (
      opportunity_id,
      lost_reason,
      lost_reason_details,
      competitor_name,
      closed_at,
      closed_by_id
    ) values (
      new.id,
      new.lost_reason,
      new.lost_reason_details,
      new.competitor_name,
      new.closed_at,
      new.closed_by_id
    );

  -- 3. Transitioning out of Closed Lost (Reopening)
  elsif TG_OP = 'UPDATE' and old.stage = 'closed_lost' and new.stage <> 'closed_lost' then
    -- Mark most recent un-reopened loss history record as reopened
    update public.crm_opportunity_loss_history
    set reopened_at = now(),
        reopened_by_id = auth.uid(),
        reopen_reason = coalesce(reopen_reason, 'Reopened from ' || old.stage || ' to ' || new.stage)
    where opportunity_id = new.id
      and reopened_at is null;

    -- Reset active loss fields
    new.lost_reason := null;
    new.lost_reason_details := null;
    new.competitor_name := null;
    new.closed_at := null;
    new.closed_by_id := null;

  -- 4. Transitioning to Closed Won
  elsif new.stage = 'closed_won' then
    new.closed_at := coalesce(new.closed_at, now());
    if auth.uid() is not null and new.closed_by_id is null then
      new.closed_by_id := auth.uid();
    end if;

  -- 5. Transitioning out of Closed Won
  elsif TG_OP = 'UPDATE' and old.stage = 'closed_won' and new.stage <> 'closed_won' then
    new.closed_at := null;
    new.closed_by_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_opp_stage_lifecycle on public.opportunities;
create trigger trg_opp_stage_lifecycle
  before insert or update on public.opportunities
  for each row
  execute function public.trg_opportunity_stage_lifecycle();

-- Helper RPC to explicitly reopen a lost opportunity
create or replace function public.reopen_closed_opportunity(
  p_opportunity_id uuid,
  p_target_stage text default 'prospecting',
  p_reopen_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_opp record;
begin
  select * into v_opp
  from public.opportunities
  where id = p_opportunity_id;

  if not found then
    raise exception 'Opportunity % not found', p_opportunity_id using errcode = 'P0002';
  end if;

  if v_opp.stage not in ('closed_lost', 'closed_won') then
    raise exception 'Opportunity is not closed (current stage: %)', v_opp.stage using errcode = '22023';
  end if;

  -- Verify update permission
  if auth.uid() is not null and not public.has_effective_permission(auth.uid(), 'opportunities.update') then
    raise exception 'Permission denied: opportunities.update required' using errcode = '42501';
  end if;

  -- Update stage and mark history
  update public.crm_opportunity_loss_history
  set reopened_at = now(),
      reopened_by_id = auth.uid(),
      reopen_reason = coalesce(p_reopen_reason, 'Reopened to ' || p_target_stage)
  where opportunity_id = p_opportunity_id
    and reopened_at is null;

  update public.opportunities
  set stage = p_target_stage,
      lost_reason = null,
      lost_reason_details = null,
      competitor_name = null,
      closed_at = null,
      closed_by_id = null,
      stage_entered_at = now(),
      updated_at = now()
  where id = p_opportunity_id;

  return jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'new_stage', p_target_stage
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Update opportunities_readable view to include new Phase 05C columns
-- -----------------------------------------------------------------------------
create or replace view public.opportunities_readable as
select
  o.id,
  o.name,
  o.account_id,
  o.owner_id,
  o.stage,
  o.amount,
  o.close_date,
  o.probability,
  o.created_at,
  o.updated_at,
  o.primary_campaign_source_id,
  case
    when public.crm_shared_field_access((select id from public.crm_field_definitions where module = 'opportunities' and key = 'lead_source' limit 1))
    then o.lead_source::character varying
    else null::character varying
  end as lead_source,
  o.price_sync_mode,
  o.price_book_id,
  o.items_subtotal,
  o.items_discount,
  o.items_tax,
  -- New Phase 05C columns appended to preserve view schema compatibility
  o.lost_reason,
  o.lost_reason_details,
  o.competitor_name,
  o.closed_at,
  o.closed_by_id,
  o.next_step,
  o.next_activity_date,
  o.stage_entered_at,
  floor(extract(epoch from (now() - o.created_at)) / 86400)::int as opportunity_age_days,
  floor(extract(epoch from (now() - coalesce(o.stage_entered_at, o.updated_at, o.created_at))) / 86400)::int as days_in_stage,
  case
    when o.stage not in ('closed_won', 'closed_lost')
      and (now() - coalesce(o.stage_entered_at, o.updated_at, o.created_at)) > interval '14 days'
    then true
    else false
  end as is_stalled
from public.opportunities o;

alter view public.opportunities_readable owner to crm_masked_reader;
grant select on public.opportunities_readable to authenticated, anon;


-- -----------------------------------------------------------------------------
-- 3. WORKSTREAM B: DUPLICATE DETECTION & RECORD MERGING
-- -----------------------------------------------------------------------------

create table if not exists public.crm_duplicate_rules (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('accounts', 'contacts', 'opportunities')),
  rule_name text not null,
  match_fields text[] not null,
  threshold numeric not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed default rules
insert into public.crm_duplicate_rules (entity_type, rule_name, match_fields, threshold, is_active)
values
  ('contacts', 'Exact Email Match', array['email'], 100, true),
  ('contacts', 'Normalized Phone Match', array['contact_number'], 90, true),
  ('contacts', 'First Name and Last Name Match', array['first_name', 'last_name'], 80, true),
  ('accounts', 'Exact Account Name Match', array['name'], 100, true),
  ('accounts', 'Normalized Domain Match', array['website'], 90, true),
  ('accounts', 'Normalized Phone Match', array['contact_number'], 85, true)
on conflict do nothing;

create table if not exists public.crm_merge_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('accounts', 'contacts', 'opportunities')),
  master_id uuid not null,
  victim_id uuid not null,
  merge_details jsonb not null default '{}'::jsonb,
  merged_by_id uuid references public.user_profiles(id) on delete set null,
  merged_at timestamptz not null default now()
);

-- Search duplicate accounts RPC
create or replace function public.find_duplicate_accounts(
  p_name text default null,
  p_phone text default null,
  p_website text default null,
  p_exclude_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_norm_phone text;
  v_norm_website text;
  v_results jsonb;
begin
  if p_phone is not null and btrim(p_phone) <> '' then
    v_norm_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  end if;

  if p_website is not null and btrim(p_website) <> '' then
    v_norm_website := lower(regexp_replace(regexp_replace(btrim(p_website), '^https?://(www\.)?', '', 'i'), '/.*$', ''));
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb) into v_results
  from (
    select
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'website', a.website,
        'contact_number', a.contact_number,
        'annual_revenue', a.annual_revenue,
        'industry', a.industry,
        'account_owner_id', a.account_owner_id,
        'created_at', a.created_at,
        'match_reasons', matches.reasons,
        'confidence_score', matches.score
      ) as item,
      matches.score
    from public.accounts a
    cross join lateral (
      select
        array_remove(array[
          case when p_name is not null and btrim(p_name) <> '' and lower(btrim(a.name)) = lower(btrim(p_name)) then 'Exact Name Match' end,
          case when v_norm_phone is not null and length(v_norm_phone) >= 7 and regexp_replace(coalesce(a.contact_number, ''), '[^0-9]', '', 'g') = v_norm_phone then 'Phone Number Match' end,
          case when v_norm_website is not null and length(v_norm_website) >= 3 and lower(regexp_replace(regexp_replace(coalesce(a.website, ''), '^https?://(www\.)?', '', 'i'), '/.*$', '')) = v_norm_website then 'Domain Match' end
        ], null) as reasons,
        case
          when p_name is not null and btrim(p_name) <> '' and lower(btrim(a.name)) = lower(btrim(p_name)) then 100
          when v_norm_phone is not null and length(v_norm_phone) >= 7 and regexp_replace(coalesce(a.contact_number, ''), '[^0-9]', '', 'g') = v_norm_phone then 90
          when v_norm_website is not null and length(v_norm_website) >= 3 and lower(regexp_replace(regexp_replace(coalesce(a.website, ''), '^https?://(www\.)?', '', 'i'), '/.*$', '')) = v_norm_website then 85
          else 0
        end as score
    ) matches
    where (p_exclude_id is null or a.id <> p_exclude_id)
      and cardinality(matches.reasons) > 0
    order by matches.score desc
    limit 10
  ) sub;

  return v_results;
end;
$$;

-- Search duplicate contacts RPC
create or replace function public.find_duplicate_contacts(
  p_email text default null,
  p_phone text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_exclude_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_norm_phone text;
  v_results jsonb;
begin
  if p_phone is not null and btrim(p_phone) <> '' then
    v_norm_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb) into v_results
  from (
    select
      jsonb_build_object(
        'id', c.id,
        'first_name', c.first_name,
        'last_name', c.last_name,
        'email', c.email,
        'contact_number', c.contact_number,
        'account_id', c.account_id,
        'created_at', c.created_at,
        'match_reasons', matches.reasons,
        'confidence_score', matches.score
      ) as item,
      matches.score
    from public.contacts c
    cross join lateral (
      select
        array_remove(array[
          case when p_email is not null and btrim(p_email) <> '' and lower(btrim(c.email)) = lower(btrim(p_email)) then 'Exact Email Match' end,
          case when v_norm_phone is not null and length(v_norm_phone) >= 7 and regexp_replace(coalesce(c.contact_number, ''), '[^0-9]', '', 'g') = v_norm_phone then 'Phone Number Match' end,
          case when p_first_name is not null and p_last_name is not null and lower(btrim(c.first_name)) = lower(btrim(p_first_name)) and lower(btrim(c.last_name)) = lower(btrim(p_last_name)) then 'Name Match' end
        ], null) as reasons,
        case
          when p_email is not null and btrim(p_email) <> '' and lower(btrim(c.email)) = lower(btrim(p_email)) then 100
          when v_norm_phone is not null and length(v_norm_phone) >= 7 and regexp_replace(coalesce(c.contact_number, ''), '[^0-9]', '', 'g') = v_norm_phone then 90
          when p_first_name is not null and p_last_name is not null and lower(btrim(c.first_name)) = lower(btrim(p_first_name)) and lower(btrim(c.last_name)) = lower(btrim(p_last_name)) then 80
          else 0
        end as score
    ) matches
    where (p_exclude_id is null or c.id <> p_exclude_id)
      and cardinality(matches.reasons) > 0
    order by matches.score desc
    limit 10
  ) sub;

  return v_results;
end;
$$;

-- Atomic Merge Accounts RPC
create or replace function public.merge_accounts(
  p_master_id uuid,
  p_victim_id uuid,
  p_field_overrides jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_master record;
  v_victim record;
  v_repointed_contacts int := 0;
  v_repointed_opps int := 0;
  v_repointed_quotes int := 0;
  v_repointed_activities int := 0;
begin
  if p_master_id = p_victim_id then
    raise exception 'Master record and Victim record cannot be the same account' using errcode = '22023';
  end if;

  -- Security check
  if auth.uid() is not null then
    if not (public.has_effective_permission(auth.uid(), 'accounts.update') and public.has_effective_permission(auth.uid(), 'accounts.delete')) then
      raise exception 'Permission denied: accounts.update and accounts.delete required for merging' using errcode = '42501';
    end if;
  end if;

  select * into v_master from public.accounts where id = p_master_id;
  if not found then
    raise exception 'Master account % does not exist', p_master_id using errcode = 'P0002';
  end if;

  select * into v_victim from public.accounts where id = p_victim_id;
  if not found then
    raise exception 'Victim account % does not exist', p_victim_id using errcode = 'P0002';
  end if;

  -- 1. Repoint Child Contacts
  update public.contacts
  set account_id = p_master_id
  where account_id = p_victim_id;
  get diagnostics v_repointed_contacts = row_count;

  -- 2. Repoint Opportunities
  update public.opportunities
  set account_id = p_master_id
  where account_id = p_victim_id;
  get diagnostics v_repointed_opps = row_count;

  -- 3. Repoint Contact Account Relationships
  update public.contact_account_relationships
  set account_id = p_master_id
  where account_id = p_victim_id
    and not exists (
      select 1 from public.contact_account_relationships r2
      where r2.contact_id = contact_account_relationships.contact_id
        and r2.account_id = p_master_id
    );
  delete from public.contact_account_relationships where account_id = p_victim_id;

  -- 4. Repoint Quotes
  update public.crm_quotes
  set account_id = p_master_id
  where account_id = p_victim_id;
  get diagnostics v_repointed_quotes = row_count;

  -- 5. Repoint Activities
  update public.activities
  set related_to_id = p_master_id
  where related_to_type = 'account' and related_to_id = p_victim_id;
  get diagnostics v_repointed_activities = row_count;

  -- 6. Repoint Converted Leads
  update public.leads
  set converted_account_id = p_master_id
  where converted_account_id = p_victim_id;

  -- 7. Apply Field Overrides to Master Record
  if p_field_overrides is not null and p_field_overrides <> '{}'::jsonb then
    update public.accounts
    set name = coalesce(p_field_overrides->>'name', name),
        contact_number = coalesce(p_field_overrides->>'contact_number', contact_number),
        website = coalesce(p_field_overrides->>'website', website),
        annual_revenue = case when p_field_overrides ? 'annual_revenue' then (p_field_overrides->>'annual_revenue')::numeric else annual_revenue end,
        industry = coalesce(p_field_overrides->>'industry', industry),
        billing_address = coalesce(p_field_overrides->>'billing_address', billing_address),
        shipping_address = coalesce(p_field_overrides->>'shipping_address', shipping_address),
        account_source = coalesce(p_field_overrides->>'account_source', account_source),
        updated_at = now()
    where id = p_master_id;
  end if;

  -- 8. Archive victim to recycle bin for audit/recovery
  insert into public.crm_recycle_bin (model_name, record_id, record_name, data, deleted_by_id)
  values (
    'accounts',
    v_victim.id,
    v_victim.name,
    to_jsonb(v_victim) || jsonb_build_object('merged_into_id', p_master_id),
    coalesce(auth.uid(), v_victim.account_owner_id)
  );

  -- 9. Log merge event
  insert into public.crm_merge_logs (
    entity_type,
    master_id,
    victim_id,
    merge_details,
    merged_by_id
  ) values (
    'accounts',
    p_master_id,
    p_victim_id,
    jsonb_build_object(
      'master_name', v_master.name,
      'victim_name', v_victim.name,
      'repointed_contacts', v_repointed_contacts,
      'repointed_opportunities', v_repointed_opps,
      'repointed_quotes', v_repointed_quotes,
      'repointed_activities', v_repointed_activities,
      'overrides', p_field_overrides
    ),
    auth.uid()
  );

  -- 10. Delete victim account
  delete from public.accounts where id = p_victim_id;

  return jsonb_build_object(
    'success', true,
    'master_id', p_master_id,
    'victim_id', p_victim_id,
    'repointed_contacts', v_repointed_contacts,
    'repointed_opportunities', v_repointed_opps,
    'repointed_quotes', v_repointed_quotes,
    'repointed_activities', v_repointed_activities
  );
end;
$$;

-- Atomic Merge Contacts RPC
create or replace function public.merge_contacts(
  p_master_id uuid,
  p_victim_id uuid,
  p_field_overrides jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_master record;
  v_victim record;
  v_repointed_quotes int := 0;
  v_repointed_campaign_members int := 0;
  v_repointed_activities int := 0;
begin
  if p_master_id = p_victim_id then
    raise exception 'Master record and Victim record cannot be the same contact' using errcode = '22023';
  end if;

  -- Security check
  if auth.uid() is not null then
    if not (public.has_effective_permission(auth.uid(), 'contacts.update') and public.has_effective_permission(auth.uid(), 'contacts.delete')) then
      raise exception 'Permission denied: contacts.update and contacts.delete required for merging' using errcode = '42501';
    end if;
  end if;

  select * into v_master from public.contacts where id = p_master_id;
  if not found then
    raise exception 'Master contact % does not exist', p_master_id using errcode = 'P0002';
  end if;

  select * into v_victim from public.contacts where id = p_victim_id;
  if not found then
    raise exception 'Victim contact % does not exist', p_victim_id using errcode = 'P0002';
  end if;

  -- 1. Repoint Opportunity Contact Roles
  update public.opportunity_contact_roles
  set contact_id = p_master_id
  where contact_id = p_victim_id
    and not exists (
      select 1 from public.opportunity_contact_roles r2
      where r2.opportunity_id = opportunity_contact_roles.opportunity_id
        and r2.contact_id = p_master_id
    );
  delete from public.opportunity_contact_roles where contact_id = p_victim_id;

  -- 2. Repoint Campaign Members
  update public.campaign_members
  set contact_id = p_master_id
  where contact_id = p_victim_id
    and not exists (
      select 1 from public.campaign_members cm2
      where cm2.campaign_id = campaign_members.campaign_id
        and cm2.contact_id = p_master_id
    );
  delete from public.campaign_members where contact_id = p_victim_id;
  get diagnostics v_repointed_campaign_members = row_count;

  -- 3. Repoint Quotes
  update public.crm_quotes
  set contact_id = p_master_id
  where contact_id = p_victim_id;
  get diagnostics v_repointed_quotes = row_count;

  -- 4. Repoint Activities
  update public.activities
  set related_to_id = p_master_id
  where related_to_type = 'contact' and related_to_id = p_victim_id;
  get diagnostics v_repointed_activities = row_count;

  -- 5. Repoint Converted Leads
  update public.leads
  set converted_contact_id = p_master_id
  where converted_contact_id = p_victim_id;

  -- 6. Repoint Contact Account Relationships
  update public.contact_account_relationships
  set contact_id = p_master_id
  where contact_id = p_victim_id
    and not exists (
      select 1 from public.contact_account_relationships r2
      where r2.account_id = contact_account_relationships.account_id
        and r2.contact_id = p_master_id
    );
  delete from public.contact_account_relationships where contact_id = p_victim_id;

  -- 7. Apply Field Overrides to Master Record
  if p_field_overrides is not null and p_field_overrides <> '{}'::jsonb then
    update public.contacts
    set first_name = coalesce(p_field_overrides->>'first_name', first_name),
        last_name = coalesce(p_field_overrides->>'last_name', last_name),
        email = coalesce(p_field_overrides->>'email', email),
        contact_number = coalesce(p_field_overrides->>'contact_number', contact_number),
        secondary_contact_number = coalesce(p_field_overrides->>'secondary_contact_number', secondary_contact_number),
        title = coalesce(p_field_overrides->>'title', title),
        contact_source = coalesce(p_field_overrides->>'contact_source', contact_source),
        updated_at = now()
    where id = p_master_id;
  end if;

  -- 8. Archive victim to recycle bin for audit/recovery
  insert into public.crm_recycle_bin (model_name, record_id, record_name, data, deleted_by_id)
  values (
    'contacts',
    v_victim.id,
    v_victim.first_name || ' ' || v_victim.last_name,
    to_jsonb(v_victim) || jsonb_build_object('merged_into_id', p_master_id),
    coalesce(auth.uid(), v_victim.contact_owner_id)
  );

  -- 9. Log merge event
  insert into public.crm_merge_logs (
    entity_type,
    master_id,
    victim_id,
    merge_details,
    merged_by_id
  ) values (
    'contacts',
    p_master_id,
    p_victim_id,
    jsonb_build_object(
      'master_name', v_master.first_name || ' ' || v_master.last_name,
      'victim_name', v_victim.first_name || ' ' || v_victim.last_name,
      'repointed_quotes', v_repointed_quotes,
      'repointed_campaign_members', v_repointed_campaign_members,
      'repointed_activities', v_repointed_activities,
      'overrides', p_field_overrides
    ),
    auth.uid()
  );

  -- 10. Delete victim contact
  delete from public.contacts where id = p_victim_id;

  return jsonb_build_object(
    'success', true,
    'master_id', p_master_id,
    'victim_id', p_victim_id,
    'repointed_quotes', v_repointed_quotes,
    'repointed_campaign_members', v_repointed_campaign_members,
    'repointed_activities', v_repointed_activities
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. WORKSTREAM D: SALES QUOTAS, TARGETS & PERFORMANCE TRACKING
-- -----------------------------------------------------------------------------

create table if not exists public.crm_sales_quotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  period_type text not null check (period_type in ('monthly', 'quarterly', 'yearly')),
  period_start date not null,
  period_end date not null,
  target_amount numeric(15, 2) not null check (target_amount >= 0),
  currency text not null default 'USD',
  created_by_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_sales_quotas_unique_user_period unique (user_id, period_type, period_start)
);

create index if not exists idx_sales_quotas_user_dates
  on public.crm_sales_quotas(user_id, period_start, period_end);

-- Comprehensive Sales Performance Leaderboard RPC with Quotas and No Double-Counting
create or replace function public.get_sales_performance_leaderboard(
  p_period_start date default null,
  p_period_end date default null,
  p_period_type text default 'monthly'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
  v_start date := coalesce(p_period_start, date_trunc('month', current_date)::date);
  v_end date := coalesce(p_period_end, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
begin
  -- Permission check
  if auth.uid() is not null and not public.has_effective_permission(auth.uid(), 'sales_performance.view') then
    raise exception 'Permission denied: sales_performance.view required' using errcode = '42501';
  end if;

  with user_base as (
    select
      u.id,
      btrim(concat(u.first_name, ' ', u.last_name)) as full_name,
      u.email,
      u.department,
      u.designation,
      r.name as role_name,
      r.id as role_id,
      coalesce(r.hierarchy_rank, 999) as hierarchy_rank,
      btrim(concat(m.first_name, ' ', m.last_name)) as manager_name
    from public.user_profiles u
    left join public.user_roles ur on ur.user_id = u.id
    left join public.roles r on r.id = ur.role_id
    left join public.sales_reporting_relationships srr on srr.user_id = u.id
    left join public.user_profiles m on m.id = srr.manager_id
    where u.is_active = true
  ),
  -- Calculate deal allocations preventing double-counting via team splits
  opp_split_allocations as (
    select
      coalesce(tm.user_id, o.owner_id) as assigned_user_id,
      o.id as opportunity_id,
      o.stage,
      case
        -- If team members exist, allocate proportional split percentage
        when tm.split_percentage is not null then round((coalesce(o.amount, 0) * (tm.split_percentage / 100.0)), 2)
        -- Otherwise 100% to opportunity owner
        else coalesce(o.amount, 0)
      end as allocated_amount
    from public.opportunities o
    left join public.opportunity_team_members tm on tm.opportunity_id = o.id
    where (o.close_date >= v_start and o.close_date <= v_end)
  ),
  user_metrics as (
    select
      ub.id as user_id,
      coalesce(sum(case when osa.stage = 'closed_won' then osa.allocated_amount else 0 end), 0) as won_revenue,
      count(distinct case when osa.stage = 'closed_won' then osa.opportunity_id end) as won_deals_count,
      coalesce(sum(case when osa.stage not in ('closed_won', 'closed_lost') then osa.allocated_amount else 0 end), 0) as open_pipeline_value,
      count(distinct case when osa.stage not in ('closed_won', 'closed_lost') then osa.opportunity_id end) as open_deals_count
    from user_base ub
    left join opp_split_allocations osa on osa.assigned_user_id = ub.id
    group by ub.id
  ),
  user_quotas as (
    select
      ub.id as user_id,
      coalesce(
        sq.target_amount,
        -- Fallback default quota by role if not explicitly set
        case ub.role_name
          when 'BDO' then 50000.00
          when 'ASM' then 150000.00
          when 'SSM' then 350000.00
          when 'RSM' then 750000.00
          when 'HEAD_OF_SALES' then 2000000.00
          when 'SUPER_ADMIN' then 2500000.00
          else 50000.00
        end
      ) as quota_amount,
      sq.id as quota_id,
      sq.currency as quota_currency
    from user_base ub
    left join public.crm_sales_quotas sq
      on sq.user_id = ub.id
     and sq.period_type = p_period_type
     and sq.period_start = v_start
  ),
  leaderboard_items as (
    select
      ub.id,
      ub.full_name as name,
      ub.email,
      ub.role_id as "roleId",
      ub.role_name as "roleName",
      ub.hierarchy_rank as "hierarchyRank",
      ub.department,
      ub.designation,
      ub.manager_name as "managerName",
      um.won_revenue as "wonRevenue",
      um.won_deals_count as "wonDealsCount",
      um.open_pipeline_value as "openPipelineValue",
      um.open_deals_count as "openDealsCount",
      uq.quota_amount as "quota",
      uq.quota_id as "quotaId",
      case
        when uq.quota_amount > 0 then round((um.won_revenue / uq.quota_amount) * 100.0, 2)
        else 0.00
      end as "attainmentPercent"
    from user_base ub
    join user_metrics um on um.user_id = ub.id
    join user_quotas uq on uq.user_id = ub.id
    order by "attainmentPercent" desc, "wonRevenue" desc
  ),
  summary_stats as (
    select
      coalesce(sum("wonRevenue"), 0) as total_team_won,
      coalesce(sum("quota"), 0) as total_team_quota,
      case
        when sum("quota") > 0 then round((sum("wonRevenue") / sum("quota")) * 100.0, 2)
        else 0.00
      end as overall_attainment,
      coalesce(sum("openPipelineValue"), 0) as total_open_pipeline,
      count(*) as active_reps_count
    from leaderboard_items
  )
  select jsonb_build_object(
    'period_start', v_start,
    'period_end', v_end,
    'period_type', p_period_type,
    'totalTeamWon', s.total_team_won,
    'totalTeamQuota', s.total_team_quota,
    'overallAttainment', s.overall_attainment,
    'totalOpenPipeline', s.total_open_pipeline,
    'activeRepsCount', s.active_reps_count,
    'reps', coalesce(jsonb_agg(li.*), '[]'::jsonb),
    'topPerformer', (select to_jsonb(li_first.*) from leaderboard_items li_first limit 1)
  ) into v_result
  from summary_stats s
  cross join leaderboard_items li
  group by s.total_team_won, s.total_team_quota, s.overall_attainment, s.total_open_pipeline, s.active_reps_count;

  return coalesce(v_result, jsonb_build_object(
    'period_start', v_start,
    'period_end', v_end,
    'totalTeamWon', 0,
    'totalTeamQuota', 0,
    'overallAttainment', 0,
    'totalOpenPipeline', 0,
    'activeRepsCount', 0,
    'reps', '[]'::jsonb,
    'topPerformer', null
  ));
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. RLS AND SECURITY PRIVILEGES
-- -----------------------------------------------------------------------------

alter table public.crm_opportunity_loss_history enable row level security;
alter table public.crm_duplicate_rules enable row level security;
alter table public.crm_merge_logs enable row level security;
alter table public.crm_sales_quotas enable row level security;

-- Policies for loss history
drop policy if exists "loss_history_select" on public.crm_opportunity_loss_history;
create policy "loss_history_select"
  on public.crm_opportunity_loss_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = crm_opportunity_loss_history.opportunity_id
    )
  );

drop policy if exists "loss_history_insert" on public.crm_opportunity_loss_history;
create policy "loss_history_insert"
  on public.crm_opportunity_loss_history
  for insert
  to authenticated
  with check (true);

-- Policies for duplicate rules
drop policy if exists "duplicate_rules_select" on public.crm_duplicate_rules;
create policy "duplicate_rules_select"
  on public.crm_duplicate_rules
  for select
  to authenticated
  using (true);

drop policy if exists "duplicate_rules_manage" on public.crm_duplicate_rules;
create policy "duplicate_rules_manage"
  on public.crm_duplicate_rules
  for all
  to authenticated
  using (
    public.has_effective_permission(auth.uid(), 'data_quality.manage')
    or public.has_effective_permission(auth.uid(), 'settings.update')
  );

-- Policies for merge logs
drop policy if exists "merge_logs_select" on public.crm_merge_logs;
create policy "merge_logs_select"
  on public.crm_merge_logs
  for select
  to authenticated
  using (true);

drop policy if exists "merge_logs_insert" on public.crm_merge_logs;
create policy "merge_logs_insert"
  on public.crm_merge_logs
  for insert
  to authenticated
  with check (true);

-- Policies for sales quotas
drop policy if exists "sales_quotas_select" on public.crm_sales_quotas;
create policy "sales_quotas_select"
  on public.crm_sales_quotas
  for select
  to authenticated
  using (true);

drop policy if exists "sales_quotas_manage" on public.crm_sales_quotas;
create policy "sales_quotas_manage"
  on public.crm_sales_quotas
  for all
  to authenticated
  using (
    public.has_effective_permission(auth.uid(), 'sales_targets.manage')
    or public.has_effective_permission(auth.uid(), 'settings.update')
  );

-- Grants
grant select, insert, update on public.crm_opportunity_loss_history to authenticated, service_role;
grant select, insert, update, delete on public.crm_duplicate_rules to authenticated, service_role;
grant select, insert on public.crm_merge_logs to authenticated, service_role;
grant select, insert, update, delete on public.crm_sales_quotas to authenticated, service_role;

grant execute on function public.reopen_closed_opportunity to authenticated, service_role;
grant execute on function public.find_duplicate_accounts to authenticated, service_role;
grant execute on function public.find_duplicate_contacts to authenticated, service_role;
grant execute on function public.merge_accounts to authenticated, service_role;
grant execute on function public.merge_contacts to authenticated, service_role;
grant execute on function public.get_sales_performance_leaderboard to authenticated, service_role;

commit;
