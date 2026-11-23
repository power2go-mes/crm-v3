begin;
-- No hashes, passwords, tokens or guessed historical timestamps are copied.
create table public.user_password_changes(
 user_id uuid primary key references auth.users(id) on delete cascade,
 changed_at timestamptz not null
);
alter table public.user_password_changes enable row level security;
create policy own_password_change_read on public.user_password_changes for select to authenticated
 using(user_id=auth.uid() and public.is_active_employee());
revoke all on public.user_password_changes from public,anon,authenticated;
grant select on public.user_password_changes to authenticated;
create function public.capture_password_change_timestamp() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.encrypted_password is distinct from old.encrypted_password and coalesce(new.encrypted_password,'')<>'' then
  insert into public.user_password_changes(user_id,changed_at) values(new.id,clock_timestamp())
  on conflict(user_id) do update set changed_at=excluded.changed_at;
 end if;
 return new;
end $$;
revoke all on function public.capture_password_change_timestamp() from public,anon,authenticated;
create trigger crm_password_changed after update of encrypted_password on auth.users
 for each row execute function public.capture_password_change_timestamp();
commit;
