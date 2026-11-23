begin;
insert into public.permissions(id,module,action,description) values
 ('login_history.view_own','login_history','view_own','Review own sign-in activity'),
 ('login_history.view_team','login_history','view_team','Review authorized hierarchy sign-in activity')
on conflict(id) do nothing;
create table public.crm_login_history(
 id uuid primary key default gen_random_uuid(),
 auth_session_id uuid not null,
 event_type text not null check(event_type in('login','logout')),
 user_id uuid not null references auth.users(id) on delete cascade,
 login_at timestamptz not null,
 user_agent text,
 ip text,
 expires_at timestamptz,
 ended_at timestamptz,
 unique(auth_session_id,event_type)
);
create index crm_login_history_user_time on public.crm_login_history(user_id,login_at desc,id);
alter table public.crm_login_history enable row level security;
create policy scoped_login_history on public.crm_login_history for select to authenticated using(
 public.is_active_employee() and (
  (user_id=auth.uid() and (public.has_effective_permission(auth.uid(),'login_history.view_own') or public.has_effective_permission(auth.uid(),'login_history.view_team')))
  or (public.has_effective_permission(auth.uid(),'login_history.view_team') and public.has_effective_permission(auth.uid(),'users.view') and user_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid())))
 ));
revoke all on public.crm_login_history from public,anon,authenticated;
-- Internal session correlation is never available through authenticated REST SELECT *.
grant select(id,user_id,login_at,user_agent,ip,expires_at,ended_at,event_type) on public.crm_login_history to authenticated;
create function public.capture_login_history() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then
  if not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
  update public.crm_login_history set ended_at=clock_timestamp() where auth_session_id=old.id and ended_at is null;
  insert into public.crm_login_history(auth_session_id,event_type,user_id,login_at,user_agent,ip,ended_at)
  values(old.id,'logout',old.user_id,clock_timestamp(),left(old.user_agent,2048),host(old.ip),clock_timestamp())
  on conflict(auth_session_id,event_type) do nothing;
  return old;
 elsif tg_op='UPDATE' then
  update public.crm_login_history set expires_at=new.not_after where auth_session_id=new.id;
 else
  insert into public.crm_login_history(auth_session_id,event_type,user_id,login_at,user_agent,ip,expires_at)
  values(new.id,'login',new.user_id,coalesce(new.created_at,clock_timestamp()),left(new.user_agent,2048),host(new.ip),new.not_after)
  on conflict(auth_session_id,event_type) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.capture_login_history() from public,anon,authenticated;
create trigger crm_capture_auth_session after insert or delete or update of not_after on auth.sessions
 for each row execute function public.capture_login_history();
-- Future events only. Existing sessions/failed attempts are not reconstructed or guessed.
commit;
