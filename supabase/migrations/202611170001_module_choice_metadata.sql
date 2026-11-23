begin;
update public.crm_field_definitions set type='single_choice',choices='["prospect", "customer_direct", "customer_channel", "channel_partner_reseller", "installation_partner", "technology_partner", "other"]'::jsonb,required=false,relaxable=true where module='accounts' and key='account_type';
update public.crm_field_definitions set type='single_choice',choices='["web", "phone_inquiry", "partner_referral", "purchased_list", "email", "other"]'::jsonb,required=false,relaxable=true where module='contacts' and key='contact_source';
update public.crm_field_definitions set type='single_choice',choices='["website", "referral", "event", "campaign", "phone", "email", "social media", "partner", "other"]'::jsonb,required=false,relaxable=true where module='opportunities' and key='lead_source';
update public.crm_field_definitions set type='single_choice',choices='["email", "event", "social_media", "other", "webinar", "referral", "advertisement"]'::jsonb,required=true,relaxable=false where module='campaigns' and key='campaign_type';
commit;
