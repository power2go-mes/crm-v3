begin;
-- Match v2 SET_NULL member history without rewriting existing associations.
alter table public.campaign_members drop constraint campaign_members_lead_id_fkey,drop constraint campaign_members_contact_id_fkey,drop constraint chk_member_target;
alter table public.campaign_members add constraint campaign_members_lead_id_fkey foreign key(lead_id) references public.leads(id) on delete set null,add constraint campaign_members_contact_id_fkey foreign key(contact_id) references public.contacts(id) on delete set null,add constraint campaign_member_type_consistency check((member_type='lead' and contact_id is null) or(member_type='contact' and lead_id is null));
alter table public.campaign_members add column created_by_id uuid references public.user_profiles(id) on delete restrict;
alter table public.campaign_members alter column created_by_id set default auth.uid();
create function public.campaign_member_actor() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if tg_op='INSERT' then new.created_by_id=auth.uid();if (new.member_type='lead' and new.lead_id is null) or(new.member_type='contact' and new.contact_id is null) then raise exception 'Choose a member' using errcode='23514';end if;
 elsif new.created_by_id is distinct from old.created_by_id then raise exception 'Member actor immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.campaign_member_actor() from public,anon,authenticated;
create trigger campaign_member_actor before insert or update on public.campaign_members for each row execute function public.campaign_member_actor();
create function public.campaign_lead_conversion_count() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare cid uuid;begin
 for cid in select distinct campaign_id from public.campaign_members where lead_id=new.id order by campaign_id loop
 perform 1 from public.campaigns where id=cid for update;
 update public.campaigns set converted_leads_in_campaign=(select count(*) from public.campaign_members m join public.leads l on l.id=m.lead_id where m.campaign_id=cid and l.is_convert) where id=cid;
 end loop;return null;
end $$;
revoke all on function public.campaign_lead_conversion_count() from public,anon,authenticated;
create trigger campaign_lead_conversion after update of is_convert on public.leads for each row when(old.is_convert is distinct from new.is_convert) execute function public.campaign_lead_conversion_count();
create or replace function public.guard_module_classification_write() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare changed boolean;begin
 changed=(tg_op='INSERT') and ((to_jsonb(new)->tg_argv[1]) is distinct from 'null'::jsonb);
 if tg_op='UPDATE' then changed=(to_jsonb(new)->tg_argv[1]) is distinct from (to_jsonb(old)->tg_argv[1]);end if;
 if changed and exists(select 1 from public.crm_field_definitions d join public.crm_field_rules fr on fr.definition_id=d.id join public.user_roles ur on ur.role_id=fr.role_id join public.roles r on r.id=ur.role_id and r.is_active where d.module=tg_argv[0] and d.key=tg_argv[1] and ur.user_id=auth.uid() and (not fr.visible or not fr.editable)) then raise exception 'Field update denied' using errcode='42501';end if;
 return new;
end $$;
commit;
