begin;
insert into public.permissions(id,module,action,description)
 select 'dashboard.'||action,'dashboard',action,'Dashboard '||action
 from unnest(array['create','update','delete']) action on conflict(id) do nothing;

create table public.dashboard_folders(
 id uuid primary key default gen_random_uuid(),folder_owner_id uuid not null default auth.uid() references public.user_profiles(id) on delete restrict,
 name varchar(255) not null check(length(btrim(name))>0),description text,
 parent_folder_id uuid references public.dashboard_folders(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(parent_folder_id is null or parent_folder_id<>id)
);
create index dashboard_folders_owner_idx on public.dashboard_folders(folder_owner_id);
alter table public.dashboard_folders enable row level security;
create policy dashboard_folder_read on public.dashboard_folders for select to authenticated using(folder_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.view'));
create policy dashboard_folder_create on public.dashboard_folders for insert to authenticated with check(folder_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.create'));
create policy dashboard_folder_update on public.dashboard_folders for update to authenticated using(folder_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update')) with check(folder_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update'));
create policy dashboard_folder_delete on public.dashboard_folders for delete to authenticated using(folder_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.delete'));
grant select,insert,update,delete on public.dashboard_folders to authenticated;
create function public.guard_dashboard_folder_parent() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.parent_folder_id is not null then
  if not exists(select 1 from public.dashboard_folders f where f.id=new.parent_folder_id and f.folder_owner_id=new.folder_owner_id) then raise exception 'Parent folder unavailable' using errcode='42501';end if;
  if tg_op='UPDATE' and exists(with recursive parents as (
   select id,parent_folder_id,array[id] seen from public.dashboard_folders where id=new.parent_folder_id
   union all select f.id,f.parent_folder_id,p.seen||f.id from public.dashboard_folders f join parents p on f.id=p.parent_folder_id where not f.id=any(p.seen)
  ) select 1 from parents where id=new.id) then raise exception 'Folder cycle' using errcode='23514';end if;
 end if;
 return new;
end $$;
create trigger dashboard_folder_parent_guard before insert or update of parent_folder_id,folder_owner_id on public.dashboard_folders for each row execute function public.guard_dashboard_folder_parent();

create table public.saved_dashboards(
 id uuid primary key default gen_random_uuid(),dashboard_owner_id uuid not null default auth.uid() references public.user_profiles(id) on delete restrict,
 name varchar(255) not null check(length(btrim(name))>0),description text,
 folder_id uuid references public.dashboard_folders(id) on delete restrict,
 is_default boolean not null default false,is_favorite boolean not null default false,is_active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index saved_dashboards_one_default on public.saved_dashboards(dashboard_owner_id) where is_default and is_active;
create index saved_dashboards_owner_idx on public.saved_dashboards(dashboard_owner_id,created_at desc);
alter table public.saved_dashboards enable row level security;
create policy saved_dashboard_read on public.saved_dashboards for select to authenticated using(dashboard_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.view'));
create policy saved_dashboard_create on public.saved_dashboards for insert to authenticated with check(dashboard_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.create') and not is_default and (folder_id is null or exists(select 1 from public.dashboard_folders f where f.id=folder_id and f.folder_owner_id=auth.uid())));
create policy saved_dashboard_update on public.saved_dashboards for update to authenticated using(dashboard_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update')) with check(dashboard_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update') and (folder_id is null or exists(select 1 from public.dashboard_folders f where f.id=folder_id and f.folder_owner_id=auth.uid())));
create policy saved_dashboard_delete on public.saved_dashboards for delete to authenticated using(dashboard_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.delete'));
grant select,insert,update,delete on public.saved_dashboards to authenticated;

create function public.saved_dashboard_set_default(target uuid default null) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not public.has_effective_permission(auth.uid(),'dashboard.update') then raise exception 'Dashboard update denied' using errcode='42501';end if;
 if target is not null and not exists(select 1 from public.saved_dashboards d where d.id=target and d.dashboard_owner_id=auth.uid() and d.is_active) then raise exception 'Dashboard unavailable' using errcode='42501';end if;
 update public.saved_dashboards set is_default=false,updated_at=now() where dashboard_owner_id=auth.uid() and is_default;
 if target is not null then update public.saved_dashboards set is_default=true,updated_at=now() where id=target and dashboard_owner_id=auth.uid();end if;
end $$;
revoke all on function public.saved_dashboard_set_default(uuid) from public,anon;
grant execute on function public.saved_dashboard_set_default(uuid) to authenticated;

create table public.saved_dashboard_components(
 id uuid primary key default gen_random_uuid(),dashboard_id uuid not null references public.saved_dashboards(id) on delete cascade,
 component_owner_id uuid not null default auth.uid() references public.user_profiles(id) on delete restrict,
 name varchar(255) not null check(length(btrim(name))>0),component_type text not null check(component_type in ('chart','table_data','kpi')),
 source_id text not null,chart_type text,grouping_field text,secondary_grouping text,
 metric_type text default 'count',y_axis_metric_type text default 'count',columns jsonb not null default '[]'::jsonb check(jsonb_typeof(columns)='array'),
 sequence integer not null default 1 check(sequence>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((component_type='chart' and source_id in ('accounts.account_type','leads.lead_source','leads.status','campaigns.campaign_type','opportunities.lead_source')) or
       (component_type='table_data' and source_id in ('accounts','contacts','won-leads','open-leads','campaigns','won-opportunities')) or
       (component_type='kpi' and source_id in ('Total Accounts','Total Campaigns','Total Contacts','Total Leads','Total Opportunities')))
);
create index saved_dashboard_components_order_idx on public.saved_dashboard_components(dashboard_id,sequence,created_at);
alter table public.saved_dashboard_components enable row level security;
create policy saved_component_read on public.saved_dashboard_components for select to authenticated using(component_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.view') and exists(select 1 from public.saved_dashboards d where d.id=dashboard_id and d.dashboard_owner_id=auth.uid()));
create policy saved_component_create on public.saved_dashboard_components for insert to authenticated with check(component_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update') and exists(select 1 from public.saved_dashboards d where d.id=dashboard_id and d.dashboard_owner_id=auth.uid()));
create policy saved_component_update on public.saved_dashboard_components for update to authenticated using(component_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update')) with check(component_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update') and exists(select 1 from public.saved_dashboards d where d.id=dashboard_id and d.dashboard_owner_id=auth.uid()));
create policy saved_component_delete on public.saved_dashboard_components for delete to authenticated using(component_owner_id=auth.uid() and public.has_effective_permission(auth.uid(),'dashboard.update'));
grant select,insert,update,delete on public.saved_dashboard_components to authenticated;
commit;
