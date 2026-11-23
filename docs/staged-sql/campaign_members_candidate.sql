begin;
create table public.campaign_members(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.campaigns(id) on delete cascade,
 lead_id uuid references public.leads(id) on delete set null,contact_id uuid references public.contacts(id) on delete set null,
 member_type varchar(10) not null default 'lead' check(member_type in ('lead','contact')),
 member_status varchar(20) not null check(member_status in ('planned','sent','recieved','responded')),
 created_by_id uuid not null default auth.uid() references public.user_profiles(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((member_type='lead' and contact_id is null) or(member_type='contact' and lead_id is null)));
create unique index campaign_member_lead_unique on public.campaign_members(campaign_id,lead_id) where lead_id is not null;
create unique index campaign_member_contact_unique on public.campaign_members(campaign_id,contact_id) where contact_id is not null;
create index campaign_members_campaign_idx on public.campaign_members(campaign_id);
alter table public.campaign_members enable row level security;
create policy member_read on public.campaign_members for select to authenticated using(
 public.has_effective_permission(auth.uid(),'campaigns.view') and exists(select 1 from public.campaigns c where c.id=campaign_id)
 and ((member_type='lead' and exists(select 1 from public.leads l where l.id=lead_id)) or(member_type='contact' and exists(select 1 from public.contacts c where c.id=contact_id))));
create policy member_write on public.campaign_members for all to authenticated using(
 public.has_effective_permission(auth.uid(),'campaigns.update') and exists(select 1 from public.campaigns c where c.id=campaign_id)
 and ((member_type='lead' and exists(select 1 from public.leads l where l.id=lead_id)) or(member_type='contact' and exists(select 1 from public.contacts c where c.id=contact_id))))
 with check(public.has_effective_permission(auth.uid(),'campaigns.update') and exists(select 1 from public.campaigns c where c.id=campaign_id)
 and ((member_type='lead' and exists(select 1 from public.leads l where l.id=lead_id)) or(member_type='contact' and exists(select 1 from public.contacts c where c.id=contact_id))));
grant select,insert,update,delete on public.campaign_members to authenticated;
create function public.guard_campaign_member() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if tg_op='INSERT' then new.created_by_id=auth.uid();
 elsif new.created_by_id is distinct from old.created_by_id or new.campaign_id<>old.campaign_id then raise exception 'Member actor/campaign identity is immutable' using errcode='42501';end if;
 if tg_op='INSERT' and ((new.member_type='lead' and new.lead_id is null) or(new.member_type='contact' and new.contact_id is null)) then raise exception 'Choose a member' using errcode='23514';end if;
 new.updated_at=now();return new;
end $$;
revoke all on function public.guard_campaign_member() from public,anon,authenticated;
create trigger campaign_member_identity before insert or update on public.campaign_members for each row execute function public.guard_campaign_member();
create function public.refresh_campaign_member_counts() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare cid uuid;
begin
 if tg_op='DELETE' then cid=old.campaign_id;else cid=new.campaign_id;end if;
 -- Serialize counter writes for this Campaign, then recalculate from stored members.
 perform 1 from public.campaigns where id=cid for update;
 update public.campaigns set
 leads_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and lead_id is not null),
 contacts_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and contact_id is not null),
 converted_leads_in_campaign=(select count(*) from public.campaign_members m join public.leads l on l.id=m.lead_id where m.campaign_id=cid and l.is_convert),
 responses_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and member_status='responded')
 where id=cid;
 return null;
end $$;
revoke all on function public.refresh_campaign_member_counts() from public,anon,authenticated;
create trigger campaign_member_counts after insert or update or delete on public.campaign_members for each row execute function public.refresh_campaign_member_counts();
commit;
