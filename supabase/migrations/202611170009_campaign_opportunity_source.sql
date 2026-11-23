begin;
alter table public.opportunities add column primary_campaign_source_id uuid references public.campaigns(id) on delete set null;
create index opportunities_campaign_source_idx on public.opportunities(primary_campaign_source_id);
create function public.guard_opportunity_campaign_source() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.primary_campaign_source_id is not null and (tg_op='INSERT' or new.primary_campaign_source_id is distinct from old.primary_campaign_source_id) and not exists(select 1 from public.campaigns where id=new.primary_campaign_source_id) then raise exception 'Primary Campaign Source unavailable' using errcode='42501';end if;return new;
end $$;
revoke all on function public.guard_opportunity_campaign_source() from public,anon,authenticated;
create trigger opportunity_campaign_source before insert or update of primary_campaign_source_id on public.opportunities for each row execute function public.guard_opportunity_campaign_source();
commit;
