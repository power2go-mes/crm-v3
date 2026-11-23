-- Account source contract: accounts/models.py and accounts/forms.py.
-- Additive; preserves existing conversion records. Validate before application.
begin;
alter table public.accounts
  add column account_number varchar(40) not null default '',
  add column account_type varchar(80) not null default '',
  add column rating varchar(255) not null default '',
  add column site varchar(80) not null default '',
  add column parent_account_id uuid references public.accounts(id) on delete set null,
  add column billing_city varchar(100) not null default '',
  add column billing_state varchar(100) not null default '',
  add column billing_district varchar(100) not null default '',
  add column billing_zip varchar(20) not null default '',
  add column shipping_city varchar(100) not null default '',
  add column shipping_state varchar(100) not null default '',
  add column shipping_district varchar(100) not null default '',
  add column shipping_zip varchar(20) not null default '',
  add column is_partner boolean not null default false,
  add column ownership varchar(255) not null default '',
  add column description varchar(32000) not null default '';
create index accounts_parent_idx on public.accounts(parent_account_id);
create function public.validate_account_parity() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if nullif(btrim(new.name),'') is null or length(new.name)>255 then
    raise exception 'Account Name is required (maximum 255 characters)' using errcode='23514';
  end if;
  if new.annual_revenue<0 then raise exception 'Annual Revenue cannot be negative' using errcode='23514'; end if;
  if new.account_type not in ('','prospect','customer_direct','customer_channel',
    'channel_partner_reseller','installation_partner','technology_partner','other')
    or new.ownership not in ('','public','private','subsidiary','other') then
    raise exception 'Invalid account choice' using errcode='23514';
  end if;
  if new.parent_account_id is not null then
    -- RLS must allow the parent; never disclose inaccessible hierarchy records.
    if not exists(select 1 from public.accounts where id=new.parent_account_id) then
      raise exception 'Parent account unavailable' using errcode='42501';
    end if;
    if exists(with recursive ancestors as (
      select id,parent_account_id,array[id] as visited from public.accounts where id=new.parent_account_id
      union all
      select a.id,a.parent_account_id,p.visited||a.id from public.accounts a
      join ancestors p on a.id=p.parent_account_id where not a.id=any(p.visited)
    ) select 1 from ancestors where id=new.id) then
      raise exception 'Invalid parent account: circular hierarchy' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.validate_account_parity() from public,anon,authenticated;
create trigger account_parity_validation before insert or update on public.accounts
for each row execute function public.validate_account_parity();
commit;
