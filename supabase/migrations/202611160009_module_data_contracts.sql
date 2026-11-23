begin;
-- Missing historical classifications remain NULL; no business associations inferred.
alter table public.accounts add column account_type varchar(80) check(account_type in ('','prospect','customer_direct','customer_channel','channel_partner_reseller','installation_partner','technology_partner','other'));
alter table public.opportunities add column lead_source varchar(50) check(lead_source in ('','website','referral','event','campaign','phone','email','social media','partner','other'));
alter table public.contacts add column contact_source varchar(50) check(contact_source in ('','web','phone_inquiry','partner_referral','purchased_list','email','other'));
create table public.campaigns(
 id uuid primary key default gen_random_uuid(),campaign_name varchar(255) not null check(length(btrim(campaign_name))>0),
 campaign_owner_id uuid not null references public.user_profiles(id) on delete restrict,
 status varchar(20) not null default 'planned' check(status in ('new','planned','in_progress','completed','aborted')),
 campaign_type varchar(20) not null check(campaign_type in ('email','event','social_media','other','webinar','referral','advertisement')),
 start_date date,end_date date,expected_revenue numeric(15,2) check(expected_revenue>=0),budget_cost numeric(15,2) check(budget_cost>=0),actual_cost numeric(15,2) check(actual_cost>=0),expected_response double precision check(expected_response between 0 and 100),
 number_sent integer not null default 0 check(number_sent>=0),description text,parent_campaign_id uuid references public.campaigns(id) on delete set null,
 leads_in_campaign integer not null default 0,converted_leads_in_campaign integer not null default 0,contacts_in_campaign integer not null default 0,opportunities_in_campaign integer not null default 0,won_opportunities_in_campaign integer not null default 0,value_opportunities numeric(18,2) not null default 0,value_won_opportunities numeric(18,2) not null default 0,responses_in_campaign integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index campaigns_owner_idx on public.campaigns(campaign_owner_id);
create index campaigns_created_idx on public.campaigns(created_at);
create index campaigns_type_idx on public.campaigns(campaign_type);
alter table public.campaigns enable row level security;
insert into public.permissions(id,module,action,description) select 'campaigns.'||action,'campaigns',action,'Campaign '||action from unnest(array['view','create','update','delete','export']) action on conflict(id) do nothing;
create policy campaign_read on public.campaigns for select to authenticated using(public.has_effective_permission(auth.uid(),'campaigns.view') and campaign_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));
create policy campaign_create on public.campaigns for insert to authenticated with check(public.has_effective_permission(auth.uid(),'campaigns.create') and campaign_owner_id=auth.uid());
create policy campaign_update on public.campaigns for update to authenticated using(public.has_effective_permission(auth.uid(),'campaigns.update') and campaign_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))) with check(public.has_effective_permission(auth.uid(),'campaigns.update') and campaign_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())));
-- No hard-delete grant before dependency-aware recovery exists.
grant select,insert,update on public.campaigns to authenticated;
create trigger campaign_updated before update on public.campaigns for each row execute function public.set_updated_at();
create function public.campaign_parent_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(160009);
 if new.parent_campaign_id is not null then
 if not exists(select 1 from public.campaigns c where c.id=new.parent_campaign_id and c.campaign_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))) then raise exception 'Parent campaign unavailable' using errcode='42501';end if;
 if exists(with recursive ancestors as (select id,parent_campaign_id,array[id] path from public.campaigns where id=new.parent_campaign_id union all select c.id,c.parent_campaign_id,a.path||c.id from public.campaigns c join ancestors a on c.id=a.parent_campaign_id where not c.id=any(a.path)) select 1 from ancestors where id=new.id) then raise exception 'Campaign cycle' using errcode='23514';end if;
 end if;return new;
end $$;
revoke all on function public.campaign_parent_guard() from public,anon,authenticated;
create trigger campaign_parent before insert or update of parent_campaign_id on public.campaigns for each row execute function public.campaign_parent_guard();
create function public.accounts_metadata_access(rid text,action text) returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$ select action in ('view','update','export') and public.has_effective_permission(auth.uid(),'accounts.'||action) and exists(select 1 from public.accounts where id::text=rid) $$;
revoke all on function public.accounts_metadata_access(text,text) from public,anon;
grant execute on function public.accounts_metadata_access(text,text) to authenticated;
insert into public.crm_shared_modules(module,access_function) values('accounts','public.accounts_metadata_access(text,text)'::regprocedure) on conflict(module) do nothing;
create function public.contacts_metadata_access(rid text,action text) returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$ select action in ('view','update','export') and public.has_effective_permission(auth.uid(),'contacts.'||action) and exists(select 1 from public.contacts where id::text=rid) $$;
revoke all on function public.contacts_metadata_access(text,text) from public,anon;
grant execute on function public.contacts_metadata_access(text,text) to authenticated;
insert into public.crm_shared_modules(module,access_function) values('contacts','public.contacts_metadata_access(text,text)'::regprocedure) on conflict(module) do nothing;
create function public.opportunities_metadata_access(rid text,action text) returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$ select action in ('view','update','export') and public.has_effective_permission(auth.uid(),'opportunities.'||action) and exists(select 1 from public.opportunities where id::text=rid) $$;
revoke all on function public.opportunities_metadata_access(text,text) from public,anon;
grant execute on function public.opportunities_metadata_access(text,text) to authenticated;
insert into public.crm_shared_modules(module,access_function) values('opportunities','public.opportunities_metadata_access(text,text)'::regprocedure) on conflict(module) do nothing;
create function public.campaigns_metadata_access(rid text,action text) returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$ select action in ('view','update','export') and public.has_effective_permission(auth.uid(),'campaigns.'||action) and exists(select 1 from public.campaigns where id::text=rid) $$;
revoke all on function public.campaigns_metadata_access(text,text) from public,anon;
grant execute on function public.campaigns_metadata_access(text,text) to authenticated;
insert into public.crm_shared_modules(module,access_function) values('campaigns','public.campaigns_metadata_access(text,text)'::regprocedure) on conflict(module) do nothing;
insert into public.crm_field_definitions(module,key,label,type,is_custom) values('accounts','account_type','Account Type','small_text',false) on conflict(module,key) do nothing;
insert into public.crm_field_definitions(module,key,label,type,is_custom) values('contacts','contact_source','Contact Source','small_text',false) on conflict(module,key) do nothing;
insert into public.crm_field_definitions(module,key,label,type,is_custom) values('opportunities','lead_source','Lead Source','small_text',false) on conflict(module,key) do nothing;
insert into public.crm_field_definitions(module,key,label,type,is_custom) values('campaigns','campaign_type','Type','small_text',false) on conflict(module,key) do nothing;
commit;
