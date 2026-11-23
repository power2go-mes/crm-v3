begin;
create table public.contact_relationship_roles(id uuid primary key default gen_random_uuid(),name varchar(50) not null,description text);
alter table public.contact_relationship_roles enable row level security;
create policy role_read on public.contact_relationship_roles for select to authenticated using(public.has_effective_permission(auth.uid(),'contacts.view'));
create policy role_manage on public.contact_relationship_roles for all to authenticated using(public.has_effective_permission(auth.uid(),'settings.update')) with check(public.has_effective_permission(auth.uid(),'settings.update'));
grant select,insert,update,delete on public.contact_relationship_roles to authenticated;
create table public.contact_account_relationships(
 contact_id uuid not null references public.contacts(id) on delete cascade,
 account_id uuid not null references public.accounts(id) on delete cascade,
 role_id uuid references public.contact_relationship_roles(id) on delete set null,
 primary key(contact_id,account_id));
create index contact_accounts_account_idx on public.contact_account_relationships(account_id);
alter table public.contact_account_relationships enable row level security;
create policy relation_read on public.contact_account_relationships for select to authenticated using(
 exists(select 1 from public.contacts c where c.id=contact_id) and exists(select 1 from public.accounts a where a.id=account_id));
create policy relation_write on public.contact_account_relationships for all to authenticated using(
 public.has_effective_permission(auth.uid(),'contacts.update') and exists(select 1 from public.contacts c where c.id=contact_id) and exists(select 1 from public.accounts a where a.id=account_id)) with check(
 public.has_effective_permission(auth.uid(),'contacts.update') and exists(select 1 from public.contacts c where c.id=contact_id) and exists(select 1 from public.accounts a where a.id=account_id));
grant select,insert,update,delete on public.contact_account_relationships to authenticated;
-- Preserve legacy values unchanged; copy their exact existing association, with no inferred role.
insert into public.contact_account_relationships(contact_id,account_id) select id,account_id from public.contacts where account_id is not null;
create function public.guard_contact_account_identity() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if tg_op='UPDATE' and (new.contact_id<>old.contact_id or new.account_id<>old.account_id) then raise exception 'Relationship identity is immutable'; end if;
 if tg_op='DELETE' and exists(select 1 from public.contacts where id=old.contact_id and account_id=old.account_id) then raise exception 'Legacy association must be preserved'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger contact_account_identity before update or delete on public.contact_account_relationships for each row execute function public.guard_contact_account_identity();
revoke all on function public.guard_contact_account_identity() from public,anon,authenticated;
create function public.sync_contact_legacy_account() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.account_id is not null then
 insert into public.contact_account_relationships(contact_id,account_id) values(new.id,new.account_id) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.sync_contact_legacy_account() from public,anon,authenticated;
create trigger contact_legacy_account after insert or update of account_id on public.contacts for each row execute function public.sync_contact_legacy_account();
create function public.contact_accounts(cid uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select coalesce(jsonb_agg(jsonb_build_object('account_id',a.id,'name',a.name,'role_id',r.role_id,'role',rr.name,'legacy',c.account_id=a.id)),'[]'::jsonb)
 from public.contact_account_relationships r join public.accounts a on a.id=r.account_id join public.contacts c on c.id=r.contact_id left join public.contact_relationship_roles rr on rr.id=r.role_id where r.contact_id=cid
$$;
create function public.set_contact_account(cid uuid,aid uuid,rid uuid default null,remove_link boolean default false) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not public.has_effective_permission(auth.uid(),'contacts.update') or not exists(select 1 from public.contacts where id=cid) or not exists(select 1 from public.accounts where id=aid) then raise exception 'Relationship unavailable' using errcode='42501'; end if;
 if remove_link then
   if exists(select 1 from public.contacts where id=cid and account_id=aid) then raise exception 'Legacy association preserved; reconcile before removal'; end if;
   delete from public.contact_account_relationships where contact_id=cid and account_id=aid;
 else
   insert into public.contact_account_relationships values(cid,aid,rid) on conflict(contact_id,account_id) do update set role_id=excluded.role_id;
 end if;
end $$;
revoke all on function public.contact_accounts(uuid),public.set_contact_account(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.contact_accounts(uuid),public.set_contact_account(uuid,uuid,uuid,boolean) to authenticated;
create function public.contact_account_roles() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$ select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]'::jsonb) from public.contact_relationship_roles $$;
revoke all on function public.contact_account_roles() from public,anon;
grant execute on function public.contact_account_roles() to authenticated;
commit;
