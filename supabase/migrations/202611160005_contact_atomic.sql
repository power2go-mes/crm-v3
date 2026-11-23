begin;
alter table public.contacts add column parent_contact_id uuid references public.contacts(id) on delete set null,add column is_primary boolean not null default false;
create index contacts_parent_idx on public.contacts(parent_contact_id);
-- is_primary belongs to Contact; v2 defines no per-account uniqueness constraint.
create function public.contact_hierarchy_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(160005);
 if new.parent_contact_id is not null then
 if not exists(select 1 from public.contacts c where c.id=new.parent_contact_id and public.has_effective_permission(auth.uid(),'contacts.view') and c.contact_owner_id in(select accessible_user_id from public.get_accessible_user_ids(auth.uid()))) then raise exception 'Parent contact unavailable' using errcode='42501'; end if;
 if exists(with recursive ancestors as (
 select id,parent_contact_id,array[id] path from public.contacts where id=new.parent_contact_id
 union all select c.id,c.parent_contact_id,a.path||c.id from public.contacts c join ancestors a on c.id=a.parent_contact_id where not c.id=any(a.path)
 ) select 1 from ancestors where id=new.id) then raise exception 'Circular contact hierarchy' using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function public.contact_hierarchy_guard() from public,anon,authenticated;
create trigger contact_hierarchy before insert or update of parent_contact_id on public.contacts for each row execute function public.contact_hierarchy_guard();
create function public.save_contact_atomic(cid uuid,fields jsonb,relationships jsonb default null) returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result uuid; link jsonb;
begin
 if fields is null or jsonb_typeof(fields)<>'object' or exists(select 1 from jsonb_object_keys(fields) k where k not in ('title','first_name','last_name','email','contact_number','secondary_contact_number','parent_contact_id','is_primary')) then raise exception 'Invalid contact fields';end if;
 if nullif(btrim(fields->>'first_name'),'') is null or length(fields->>'first_name')>80 or nullif(btrim(fields->>'last_name'),'') is null or length(fields->>'last_name')>80 or length(fields->>'title')>100 or nullif(fields->>'email','') is null or length(fields->>'email')>100 then raise exception 'Invalid contact details' using errcode='23514';end if;
 if cid is null then
 insert into public.contacts(first_name,last_name,email,title,contact_number,secondary_contact_number,contact_owner_id,parent_contact_id,is_primary)
 values(fields->>'first_name',fields->>'last_name',fields->>'email',fields->>'title',fields->>'contact_number',fields->>'secondary_contact_number',auth.uid(),nullif(fields->>'parent_contact_id','')::uuid,coalesce((fields->>'is_primary')::boolean,false)) returning id into result;
 else
 update public.contacts set first_name=fields->>'first_name',last_name=fields->>'last_name',email=fields->>'email',title=fields->>'title',contact_number=fields->>'contact_number',secondary_contact_number=fields->>'secondary_contact_number',parent_contact_id=nullif(fields->>'parent_contact_id','')::uuid,is_primary=coalesce((fields->>'is_primary')::boolean,false) where id=cid returning id into result;
 if not found then raise exception 'Contact unavailable' using errcode='42501';end if;
 end if;
 if relationships is not null then
 if jsonb_typeof(relationships)<>'array' or jsonb_array_length(relationships)>100 then raise exception 'Invalid relationship selection';end if;
 for link in select * from jsonb_array_elements(relationships) loop
 perform public.set_contact_account(result,(link->>'account_id')::uuid,nullif(link->>'role_id','')::uuid);
 end loop;
 delete from public.contact_account_relationships r where r.contact_id=result
 and not exists(select 1 from public.contacts c where c.id=result and c.account_id=r.account_id)
 and not exists(select 1 from jsonb_array_elements(relationships) x where x->>'account_id'=r.account_id::text);
 end if;
 return result;
end $$;
revoke all on function public.save_contact_atomic(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_contact_atomic(uuid,jsonb,jsonb) to authenticated;
commit;
