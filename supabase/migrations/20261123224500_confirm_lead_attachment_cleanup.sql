begin;

create function public.confirm_expired_lead_attachment_cleanup(p_submission_id uuid,p_confirmed boolean)
returns table(lead_id uuid,object_name text)
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if auth.uid() is null
    or not coalesce(public.has_effective_permission(auth.uid(),'settings.update'),false) then
    raise exception 'Attachment cleanup is unavailable' using errcode='42501';
  end if;
  if p_confirmed is distinct from true then
    raise exception 'Confirm attachment cleanup before continuing' using errcode='22023';
  end if;
  return query select * from public.claim_expired_lead_pending_attachment(p_submission_id);
end $$;
revoke all on function public.confirm_expired_lead_attachment_cleanup(uuid,boolean) from public,anon;
revoke execute on function public.claim_expired_lead_pending_attachment(uuid) from authenticated;
grant execute on function public.confirm_expired_lead_attachment_cleanup(uuid,boolean) to authenticated;

commit;
