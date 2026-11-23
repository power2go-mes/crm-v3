begin;
create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 255),
  body text not null default '' check (char_length(body) <= 20000),
  created_by_id uuid default auth.uid() references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_notes_lead_id on public.lead_notes(lead_id, created_at desc, id);
alter table public.lead_notes enable row level security;
revoke all on public.lead_notes from public, anon, authenticated;
grant select, delete on public.lead_notes to authenticated;
grant insert (lead_id,title,body), update (title,body) on public.lead_notes to authenticated;
create policy lead_notes_read on public.lead_notes for select to authenticated
using (exists (select 1 from public.leads l where l.id=lead_id));
create policy lead_notes_insert on public.lead_notes for insert to authenticated
with check (created_by_id=auth.uid()
 and public.has_effective_permission(auth.uid(),'leads.update')
 and exists (select 1 from public.leads l where l.id=lead_id));
create policy lead_notes_edit on public.lead_notes for update to authenticated
using (public.has_effective_permission(auth.uid(),'leads.update')
 and exists (select 1 from public.leads l where l.id=lead_id))
with check (public.has_effective_permission(auth.uid(),'leads.update')
 and exists (select 1 from public.leads l where l.id=lead_id));
create policy lead_notes_remove on public.lead_notes for delete to authenticated
using (public.has_effective_permission(auth.uid(),'leads.update')
 and exists (select 1 from public.leads l where l.id=lead_id));
commit;
