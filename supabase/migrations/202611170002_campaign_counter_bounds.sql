begin;
alter table public.campaigns add constraint campaign_counter_bounds check(leads_in_campaign>=0 and converted_leads_in_campaign>=0 and contacts_in_campaign>=0 and opportunities_in_campaign>=0 and won_opportunities_in_campaign>=0 and responses_in_campaign>=0);
commit;
