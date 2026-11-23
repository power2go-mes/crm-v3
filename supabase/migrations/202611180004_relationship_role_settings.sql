begin;
-- Separate organization catalogs, never canonical authorization roles.
create table public.team_relationship_roles(id uuid primary key default gen_random_uuid(),name varchar(50) not null check(length(btrim(name))>0),description text);
create table public.partner_relationship_roles(id uuid primary key default gen_random_uuid(),name varchar(50) not null check(length(btrim(name))>0),description text);
alter table public.team_relationship_roles enable row level security;
alter table public.partner_relationship_roles enable row level security;
create policy catalog_read on public.team_relationship_roles for select to authenticated using(public.has_effective_permission(auth.uid(),'settings.view'));
create policy catalog_read on public.partner_relationship_roles for select to authenticated using(public.has_effective_permission(auth.uid(),'settings.view'));
-- Existing Contact consumers and management policy are preserved.
create policy customer_settings_read on public.contact_relationship_roles for select to authenticated using(public.has_effective_permission(auth.uid(),'settings.view'));
revoke all on public.team_relationship_roles,public.partner_relationship_roles from public,anon,authenticated;
grant select on public.team_relationship_roles,public.partner_relationship_roles to authenticated;

create function public.settings_role_catalog(p_kind text,p_search text default '',p_page integer default 1,p_sort text default 'name',p_ascending boolean default true) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare tab text; result jsonb; begin
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),'settings.view') then raise exception 'Permission denied' using errcode='42501'; end if;
 tab=case p_kind when 'customer' then 'contact_relationship_roles' when 'team' then 'team_relationship_roles' when 'partner' then 'partner_relationship_roles' end;
 if tab is null or p_page is null or p_page<1 or p_page>100000 or p_search is null or length(p_search)>200 or p_sort is null or p_sort not in ('name','description') or p_ascending is null then raise exception 'Invalid catalog request' using errcode='22023'; end if;
 execute format('select jsonb_build_object(''count'',(select count(*) from public.%1$I where strpos(lower(name),lower($1))>0),''rows'',coalesce((select jsonb_agg(to_jsonb(r)) from (select id,name,description from public.%1$I where strpos(lower(name),lower($1))>0 order by %2$I %3$s nulls last,id limit 20 offset $2) r),''[]''::jsonb))',tab,p_sort,case when p_ascending then 'asc' else 'desc' end)
 into result using btrim(p_search),(p_page-1)*20;
 return result;
end $$;

create function public.save_settings_role(p_kind text,p_id uuid,p_name text,p_description text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare tab text; result uuid; begin
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),'settings.view') or not public.has_effective_permission(auth.uid(),'settings.update') then raise exception 'Permission denied' using errcode='42501'; end if;
 tab=case p_kind when 'customer' then 'contact_relationship_roles' when 'team' then 'team_relationship_roles' when 'partner' then 'partner_relationship_roles' end;
 if tab is null or p_name is null or length(btrim(p_name)) not between 1 and 50 then raise exception 'Role Name must contain 1 to 50 characters' using errcode='23514'; end if;
 if p_id is null then
  execute format('insert into public.%I(name,description) values($1,$2) returning id',tab) into result using btrim(p_name),nullif(p_description,'');
 else
  execute format('update public.%I set name=$1,description=$2 where id=$3 returning id',tab) into result using btrim(p_name),nullif(p_description,''),p_id;
  if result is null then raise exception 'The requested data does not exist.' using errcode='P0002'; end if;
 end if;
 return result;
end $$;

create function public.delete_settings_role(p_kind text,p_id uuid,p_confirm_relationships boolean default false) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare tab text; found_id uuid; begin
 if auth.uid() is null or not public.has_effective_permission(auth.uid(),'settings.view') or not public.has_effective_permission(auth.uid(),'settings.update') then raise exception 'Permission denied' using errcode='42501'; end if;
 tab=case p_kind when 'customer' then 'contact_relationship_roles' when 'team' then 'team_relationship_roles' when 'partner' then 'partner_relationship_roles' end;
 if tab is null or p_id is null or p_confirm_relationships is null then raise exception 'Invalid catalog request' using errcode='22023'; end if;
 execute format('select id from public.%I where id=$1 for update',tab) into found_id using p_id;
 if found_id is null then raise exception 'The requested data does not exist.' using errcode='P0002'; end if;
 if p_kind='customer' and not p_confirm_relationships and exists(select 1 from public.contact_account_relationships where role_id=p_id) then
  raise exception 'This Customer Role is in use. Confirm removal of its labels; Contact and Account associations will be retained.' using errcode='23503';
 end if;
 -- The installed FK uses source-compatible SET NULL; it never deletes Contact/Account links.
 execute format('delete from public.%I where id=$1',tab) using p_id;
end $$;
revoke all on function public.settings_role_catalog(text,text,integer,text,boolean),public.save_settings_role(text,uuid,text,text),public.delete_settings_role(text,uuid,boolean) from public,anon;
grant execute on function public.settings_role_catalog(text,text,integer,text,boolean),public.save_settings_role(text,uuid,text,text),public.delete_settings_role(text,uuid,boolean) to authenticated;
commit;
