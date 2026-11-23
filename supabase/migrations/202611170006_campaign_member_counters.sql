begin;
alter table public.campaign_members alter column member_type set default 'lead',alter column member_status drop default;
create unique index campaign_members_unique_lead on public.campaign_members(campaign_id,lead_id) where lead_id is not null;
create unique index campaign_members_unique_contact on public.campaign_members(campaign_id,contact_id) where contact_id is not null;
create function public.refresh_campaign_member_counts() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare cid uuid; targets uuid[];
begin
 if tg_op='INSERT' then targets=array[new.campaign_id];elsif tg_op='DELETE' then targets=array[old.campaign_id];else targets=array[old.campaign_id,new.campaign_id];end if;
 for cid in select distinct x from unnest(targets) x order by x loop
 -- Serialize counter writes for this Campaign, then recalculate from stored members.
 perform 1 from public.campaigns where id=cid for update;
 update public.campaigns set
 leads_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and lead_id is not null),
 contacts_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and contact_id is not null),
 converted_leads_in_campaign=(select count(*) from public.campaign_members m join public.leads l on l.id=m.lead_id where m.campaign_id=cid and l.is_convert),
 responses_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and member_status='responded')
 where id=cid;
 end loop;
 return null;
end $$;
revoke all on function public.refresh_campaign_member_counts() from public,anon,authenticated;
create trigger campaign_member_counts after insert or update or delete on public.campaign_members for each row execute function public.refresh_campaign_member_counts();
commit;
