-- =============================================================================
-- Migration 00006: Leads Management Full CRM v2 Parity Schema & Supporting Engines
-- 
-- 1. Extends public.leads with full CRM v2 attributes:
--    - sub_owner_id (Assigned BDO)
--    - lead_source (Website, Referral, Event, Campaign, Phone, Email, etc.)
--    - industry (Finance, Healthcare, Manufacturing, Agriculture, etc.)
--    - no_of_employees (Positive integer)
--    - annual_revenue (Positive numeric currency)
--    - country, state, city, zip_code, fax, requirements
--    - is_convert, lead_score
-- 
-- 2. Creates public.lead_statuses table with canonical 6-stage lifecycle
-- 
-- 3. Creates minimal supporting schema for conversion:
--    - public.accounts
--    - public.contacts
--    - public.opportunities
-- 
-- 4. Creates public.lead_activities and public.lead_history for Detail tabs
-- 
-- 5. Defines atomic PostgreSQL RPC: public.convert_lead()
-- 
-- 6. Enforces RLS policies covering sales hierarchy and BDO sub_owner scoping
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lead Statuses (Canonical 6-stage lifecycle matching CRM v2)
-- -----------------------------------------------------------------------------
create table if not exists public.lead_statuses (
    id text primary key,
    name text not null,
    order_index integer not null,
    color text not null default '#3b82f6',
    probability numeric(5, 2) not null default 10,
    is_final boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.lead_statuses enable row level security;

create policy "Active employees can view lead statuses"
on public.lead_statuses for select
using (public.is_active_employee());

-- Seed canonical 6 stages matching CRM v2 DEFAULT_LEAD_INIT_STAGES
insert into public.lead_statuses (id, name, order_index, color, probability, is_final)
values
    ('new', 'New', 1, '#3b82f6', 10, false),
    ('contacted', 'Contacted', 2, '#8b5cf6', 30, false),
    ('qualified', 'Qualified', 3, '#10b981', 60, false),
    ('proposal', 'Proposal', 4, '#f59e0b', 80, false),
    ('lost', 'Lost', 5, '#ef4444', 0, false),
    ('convert', 'Convert', 6, '#059669', 100, true)
on conflict (id) do update set
    name = excluded.name,
    order_index = excluded.order_index,
    color = excluded.color,
    probability = excluded.probability,
    is_final = excluded.is_final;

-- -----------------------------------------------------------------------------
-- 2. Extend public.leads table (Non-destructive)
-- -----------------------------------------------------------------------------
alter table public.leads
    add column if not exists sub_owner_id uuid references public.user_profiles(id) on delete set null,
    add column if not exists lead_source text,
    add column if not exists industry text,
    add column if not exists no_of_employees integer check (no_of_employees is null or no_of_employees >= 0),
    add column if not exists annual_revenue numeric(15, 2) check (annual_revenue is null or annual_revenue >= 0),
    add column if not exists country text default 'India',
    add column if not exists state text,
    add column if not exists city text,
    add column if not exists zip_code text,
    add column if not exists fax text,
    add column if not exists requirements text,
    add column if not exists is_convert boolean not null default false,
    add column if not exists lead_score integer not null default 0;

-- Indices for performance
create index if not exists idx_leads_sub_owner on public.leads(sub_owner_id);
create index if not exists idx_leads_is_convert on public.leads(is_convert);
create index if not exists idx_leads_lead_source on public.leads(lead_source);
create index if not exists idx_leads_industry on public.leads(industry);

-- Enforce Assigned BDO rule: sub_owner_id must belong to a user with role 'BDO'
create or replace function public.validate_lead_sub_owner()
returns trigger as $$
declare
    v_has_bdo_role boolean;
begin
    if new.sub_owner_id is not null then
        select exists (
            select 1 from public.user_roles ur
            where ur.user_id = new.sub_owner_id and ur.role_id = 'BDO'
        ) into v_has_bdo_role;

        if not v_has_bdo_role then
            raise exception 'The assigned sub-owner must be an active BDO in this company.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql stable;

drop trigger if exists trigger_validate_lead_sub_owner on public.leads;
create trigger trigger_validate_lead_sub_owner
before insert or update on public.leads
for each row execute function public.validate_lead_sub_owner();

-- Update Leads RLS Policies to include sub_owner_id access
drop policy if exists "View leads within accessible sales scope" on public.leads;
create policy "View leads within accessible sales scope"
on public.leads for select
using (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.view')
    and (
        lead_owner_id is null
        or lead_owner_id in (select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
        or sub_owner_id = auth.uid()
    )
);

drop policy if exists "Update leads within accessible sales scope" on public.leads;
create policy "Update leads within accessible sales scope"
on public.leads for update
using (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.update')
    and (
        lead_owner_id is null
        or lead_owner_id in (select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
        or sub_owner_id = auth.uid()
    )
)
with check (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.update')
);

drop policy if exists "Delete leads requires leads.delete permission" on public.leads;
create policy "Delete leads requires leads.delete permission"
on public.leads for delete
using (
    public.is_active_employee()
    and public.has_effective_permission(auth.uid(), 'leads.delete')
    and (
        lead_owner_id is null
        or lead_owner_id in (select accessible_user_id from public.get_accessible_user_ids(auth.uid()))
    )
);

-- -----------------------------------------------------------------------------
-- 3. Minimal Supporting Tables for Lead Conversion
-- -----------------------------------------------------------------------------

-- Accounts
create table if not exists public.accounts (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    account_owner_id uuid references public.user_profiles(id) on delete set null,
    contact_number text,
    annual_revenue numeric(15, 2),
    industry text,
    no_of_employees integer,
    fax text,
    account_source text,
    website text,
    billing_address text,
    shipping_address text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Active employees can view accounts"
on public.accounts for select
using (public.is_active_employee());

create policy "Insert accounts requires accounts.create or conversion"
on public.accounts for insert
with check (public.is_active_employee());

create policy "Update accounts requires authorization"
on public.accounts for update
using (public.is_active_employee())
with check (public.is_active_employee());

-- Contacts
create table if not exists public.contacts (
    id uuid primary key default gen_random_uuid(),
    account_id uuid references public.accounts(id) on delete set null,
    first_name text not null,
    last_name text not null,
    title text,
    email text,
    contact_number text,
    secondary_contact_number text,
    contact_owner_id uuid references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "Active employees can view contacts"
on public.contacts for select
using (public.is_active_employee());

create policy "Insert contacts requires authorization"
on public.contacts for insert
with check (public.is_active_employee());

create policy "Update contacts requires authorization"
on public.contacts for update
using (public.is_active_employee())
with check (public.is_active_employee());

-- Opportunities
create table if not exists public.opportunities (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    account_id uuid references public.accounts(id) on delete cascade,
    owner_id uuid references public.user_profiles(id) on delete set null,
    stage text not null default 'Prospecting',
    amount numeric(15, 2),
    close_date date not null,
    probability numeric(5, 2) not null default 10,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;

create policy "Active employees can view opportunities"
on public.opportunities for select
using (public.is_active_employee());

create policy "Insert opportunities requires authorization"
on public.opportunities for insert
with check (public.is_active_employee());

create policy "Update opportunities requires authorization"
on public.opportunities for update
using (public.is_active_employee())
with check (public.is_active_employee());

-- -----------------------------------------------------------------------------
-- 4. Lead Activities & History (For Detail View Tabs)
-- -----------------------------------------------------------------------------
create table if not exists public.lead_activities (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    activity_type text not null check (activity_type in ('task', 'meeting', 'call', 'note', 'event')),
    subject text not null,
    description text,
    status text not null default 'completed',
    priority text default 'medium',
    due_date timestamptz,
    duration_minutes integer,
    created_by_id uuid references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_lead_activities_lead on public.lead_activities(lead_id);
alter table public.lead_activities enable row level security;

create policy "Active employees can view lead activities"
on public.lead_activities for select
using (public.is_active_employee());

create policy "Active employees can insert lead activities"
on public.lead_activities for insert
with check (public.is_active_employee());

-- Lead Audit History
create table if not exists public.lead_history (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.leads(id) on delete cascade,
    field_name text not null,
    old_value text,
    new_value text,
    actor_id uuid references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_lead_history_lead on public.lead_history(lead_id);
alter table public.lead_history enable row level security;

create policy "Active employees can view lead history"
on public.lead_history for select
using (public.is_active_employee());

-- Audit Trigger to automatically log field changes on leads
create or replace function public.log_lead_history()
returns trigger as $$
begin
    if tg_op = 'UPDATE' then
        if old.status is distinct from new.status then
            insert into public.lead_history (lead_id, field_name, old_value, new_value, actor_id)
            values (new.id, 'status', old.status, new.status, auth.uid());
        end if;
        if old.lead_owner_id is distinct from new.lead_owner_id then
            insert into public.lead_history (lead_id, field_name, old_value, new_value, actor_id)
            values (new.id, 'lead_owner', old.lead_owner_id::text, new.lead_owner_id::text, auth.uid());
        end if;
        if old.sub_owner_id is distinct from new.sub_owner_id then
            insert into public.lead_history (lead_id, field_name, old_value, new_value, actor_id)
            values (new.id, 'sub_owner', old.sub_owner_id::text, new.sub_owner_id::text, auth.uid());
        end if;
        if old.company_name is distinct from new.company_name then
            insert into public.lead_history (lead_id, field_name, old_value, new_value, actor_id)
            values (new.id, 'company_name', old.company_name, new.company_name, auth.uid());
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_log_lead_history on public.leads;
create trigger trigger_log_lead_history
after update on public.leads
for each row execute function public.log_lead_history();

-- -----------------------------------------------------------------------------
-- 5. Atomic Lead Conversion RPC
-- -----------------------------------------------------------------------------
create or replace function public.convert_lead(
    p_lead_id uuid,
    p_account_action text,
    p_account_id uuid default null,
    p_account_name text default null,
    p_contact_action text default 'create_new',
    p_contact_id uuid default null,
    p_contact_first_name text default null,
    p_contact_last_name text default null,
    p_opportunity_action text default 'create_new',
    p_opportunity_id uuid default null,
    p_opportunity_name text default null,
    p_opportunity_amount numeric default null,
    p_opportunity_close_date date default null,
    p_owner_id uuid default null
)
returns jsonb as $$
declare
    v_lead record;
    v_account_id uuid;
    v_contact_id uuid;
    v_opportunity_id uuid;
    v_owner_id uuid;
    v_caller_accessible boolean;
begin
    -- 1. Fetch lead
    select * into v_lead from public.leads where id = p_lead_id for update;
    if not found then
        raise exception 'Lead % not found', p_lead_id;
    end if;

    if v_lead.is_convert then
        raise exception 'Lead % has already been converted', p_lead_id;
    end if;

    -- 2. Verify authorization & sales scope
    if v_lead.lead_owner_id is not null then
        select exists (
            select 1 from public.get_accessible_user_ids(auth.uid())
            where accessible_user_id = v_lead.lead_owner_id
        ) into v_caller_accessible;

        if not v_caller_accessible and v_lead.sub_owner_id != auth.uid() then
            raise exception 'Access Denied: You do not have permission to convert this lead.';
        end if;
    end if;

    -- 3. Resolve target owner
    v_owner_id := coalesce(p_owner_id, v_lead.lead_owner_id, auth.uid());

    -- 4. Process Account
    if p_account_action = 'create_new' then
        insert into public.accounts (
            name, account_owner_id, contact_number, annual_revenue,
            industry, no_of_employees, fax, account_source
        )
        values (
            coalesce(nullif(p_account_name, ''), v_lead.company_name, v_lead.first_name || ' Company'),
            v_owner_id, v_lead.phone, v_lead.annual_revenue,
            v_lead.industry, v_lead.no_of_employees, v_lead.fax, v_lead.lead_source
        )
        returning id into v_account_id;
    elsif p_account_action = 'select_existing' then
        v_account_id := p_account_id;
        if v_account_id is null then
            raise exception 'Selected account ID must not be null';
        end if;
    else
        raise exception 'Invalid account action: %', p_account_action;
    end if;

    -- 5. Process Contact
    if p_contact_action = 'create_new' then
        insert into public.contacts (
            account_id, first_name, last_name, email, contact_number, contact_owner_id
        )
        values (
            v_account_id,
            coalesce(nullif(p_contact_first_name, ''), v_lead.first_name),
            coalesce(nullif(p_contact_last_name, ''), v_lead.last_name),
            v_lead.email,
            v_lead.phone,
            v_owner_id
        )
        returning id into v_contact_id;
    elsif p_contact_action = 'select_existing' then
        v_contact_id := p_contact_id;
        if v_contact_id is not null and v_account_id is not null then
            update public.contacts set account_id = v_account_id where id = v_contact_id;
        end if;
    end if;

    -- 6. Process Opportunity (Optional)
    if p_opportunity_action = 'create_new' then
        insert into public.opportunities (
            name, account_id, owner_id, stage, amount, close_date, probability
        )
        values (
            coalesce(nullif(p_opportunity_name, ''), v_lead.company_name || ' - Deal', 'New Opportunity'),
            v_account_id,
            v_owner_id,
            'Prospecting',
            p_opportunity_amount,
            coalesce(p_opportunity_close_date, (current_date + interval '30 days')::date),
            10
        )
        returning id into v_opportunity_id;
    elsif p_opportunity_action = 'select_existing' then
        v_opportunity_id := p_opportunity_id;
    end if;

    -- 7. Mark Lead as Converted
    update public.leads
    set is_convert = true,
        status = 'convert',
        updated_at = now()
    where id = p_lead_id;

    -- 8. Log Conversion Activity
    insert into public.lead_activities (
        lead_id, activity_type, subject, description, status, created_by_id
    )
    values (
        p_lead_id,
        'note',
        'Lead Converted',
        'Lead converted to Account (' || v_account_id::text || '), Contact (' || coalesce(v_contact_id::text, 'none') || '), Opportunity (' || coalesce(v_opportunity_id::text, 'none') || ')',
        'completed',
        auth.uid()
    );

    -- 9. Return JSON response
    return jsonb_build_object(
        'success', true,
        'lead_id', p_lead_id,
        'account_id', v_account_id,
        'contact_id', v_contact_id,
        'opportunity_id', v_opportunity_id
    );
end;
$$ language plpgsql security definer;
