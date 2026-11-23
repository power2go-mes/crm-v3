begin;
create function public.guard_module_classification_write() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare changed boolean;begin
 changed=tg_op='INSERT';
 if tg_op='UPDATE' then changed=(to_jsonb(new)->tg_argv[1]) is distinct from (to_jsonb(old)->tg_argv[1]);end if;
 if changed and exists(select 1 from public.crm_field_definitions d join public.crm_field_rules fr on fr.definition_id=d.id join public.user_roles ur on ur.role_id=fr.role_id join public.roles r on r.id=ur.role_id and r.is_active where d.module=tg_argv[0] and d.key=tg_argv[1] and ur.user_id=auth.uid() and (not fr.visible or not fr.editable)) then raise exception 'Field update denied' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_module_classification_write() from public,anon,authenticated;
create trigger accounts_type_field before insert or update on public.accounts for each row execute function public.guard_module_classification_write('accounts','account_type');
create trigger contacts_source_field before insert or update on public.contacts for each row execute function public.guard_module_classification_write('contacts','contact_source');
create trigger opportunities_source_field before insert or update on public.opportunities for each row execute function public.guard_module_classification_write('opportunities','lead_source');
create trigger campaigns_type_field before insert or update on public.campaigns for each row execute function public.guard_module_classification_write('campaigns','campaign_type');
commit;
