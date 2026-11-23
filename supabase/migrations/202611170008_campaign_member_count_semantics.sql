begin;
-- V2 recalculate_metrics counts member types, retaining historical orphan membership.
create or replace function public.refresh_campaign_member_counts() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare cid uuid; targets uuid[];
begin
 if tg_op='INSERT' then targets=array[new.campaign_id];elsif tg_op='DELETE' then targets=array[old.campaign_id];else targets=array[old.campaign_id,new.campaign_id];end if;
 for cid in select distinct x from unnest(targets) x order by x loop
 -- Serialize counter writes for this Campaign, then recalculate from stored members.
 perform 1 from public.campaigns where id=cid for update;
 update public.campaigns set
 leads_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and member_type='lead'),
 contacts_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and member_type='contact'),
 converted_leads_in_campaign=(select count(*) from public.campaign_members m join public.leads l on l.id=m.lead_id where m.campaign_id=cid and l.is_convert),
 responses_in_campaign=(select count(*) from public.campaign_members where campaign_id=cid and member_status='responded')
 where id=cid;
 end loop;
 return null;
end $$;
commit;
