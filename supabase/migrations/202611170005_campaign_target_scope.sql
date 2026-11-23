-- Codex-owned correction after explicit ownership handover. Preserves installed 004.
-- Additive restriction; existing Campaign/feature policies remain in force.
begin;
create policy campaign_members_target_boundary on public.campaign_members
as restrictive for all to authenticated
using (
 (member_type='lead' and exists(select 1 from public.leads l where l.id=campaign_members.lead_id))
 or (member_type='contact' and exists(select 1 from public.contacts c where c.id=campaign_members.contact_id))
)
with check (
 (member_type='lead' and exists(select 1 from public.leads l where l.id=campaign_members.lead_id))
 or (member_type='contact' and exists(select 1 from public.contacts c where c.id=campaign_members.contact_id))
);
commit;
