-- =============================================================================
-- FINLONEXA CRM v3 — Phase 1 Migration 00001: Core Schema & Single-Company Setup
-- =============================================================================

-- Ensure extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Function to automatically set updated_at timestamp
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- 1. Company Profile (SINGLE-COMPANY SINGLETON)
-- -----------------------------------------------------------------------------
create table if not exists public.company_settings (
    id integer primary key default 1 check (id = 1), -- Enforces single-company constraint
    company_name text not null default 'FINLONEXA',
    legal_name text,
    domain text,
    support_email text,
    phone_number text,
    address text,
    city text,
    state text,
    country text default 'India',
    postal_code text,
    currency text default 'INR',
    time_zone text default 'Asia/Kolkata',
    fiscal_year_start_month integer default 4, -- April
    logo_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Insert default company record if not exists
insert into public.company_settings (id, company_name)
values (1, 'FINLONEXA')
on conflict (id) do nothing;

create trigger trigger_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. User Profiles (Synced with Supabase auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique not null,
    first_name text not null default '',
    last_name text not null default '',
    phone text,
    avatar_url text,
    department text,
    designation text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_email on public.user_profiles(email);
create index if not exists idx_user_profiles_is_active on public.user_profiles(is_active);

create trigger trigger_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Automatic Profile Creation Trigger on Auth Signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.user_profiles (id, email, first_name, last_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'first_name', ''),
        coalesce(new.raw_user_meta_data->>'last_name', '')
    )
    on conflict (id) do update
    set email = excluded.email;
    return new;
end;
$$ language plpgsql security definer;

-- Trigger attached to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
