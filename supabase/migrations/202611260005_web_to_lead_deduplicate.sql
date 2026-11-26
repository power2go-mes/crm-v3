begin;

create index if not exists idx_leads_website_email_created
  on public.leads (email, created_at desc)
  where lead_source = 'website' and email is not null;

create or replace function public.submit_web_to_lead(
  p_form_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_form record;
  v_lead_id uuid;
  v_recent_id uuid;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_company text;
  v_country text;
  v_requirements text;
  v_owner_id uuid;
  v_assignment_res jsonb;
begin
  select * into v_form
  from public.crm_lead_capture_forms
  where id = p_form_id and is_active = true;
  if not found then
    raise exception 'Web capture form not found or inactive' using errcode = 'P0002';
  end if;

  v_first_name := trim(coalesce(p_payload->>'first_name', ''));
  v_last_name := trim(coalesce(p_payload->>'last_name', ''));
  v_email := lower(trim(coalesce(p_payload->>'email', '')));
  v_phone := trim(coalesce(p_payload->>'phone', ''));
  v_company := trim(coalesce(p_payload->>'company_name', p_payload->>'company', ''));
  v_country := trim(coalesce(p_payload->>'country', ''));
  v_requirements := trim(coalesce(p_payload->>'requirements', p_payload->>'message', ''));

  if v_first_name = '' and v_last_name = '' then
    v_first_name := 'Website';
    v_last_name := 'Inquiry';
  elsif v_last_name = '' then
    v_last_name := v_first_name;
    v_first_name := '';
  end if;

  v_owner_id := v_form.lead_owner_id;
  if v_owner_id is null then
    select u.id into v_owner_id
    from public.user_profiles u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where r.name in ('Super Administrator', 'Head of Sales')
    limit 1;
  end if;

  if v_email <> '' then
    perform pg_advisory_xact_lock(hashtextextended('web-to-lead:' || v_email, 0));
    select id into v_recent_id
    from public.leads
    where email = v_email
      and lead_source = 'website'
      and created_at >= now() - interval '5 minutes'
    order by created_at desc
    limit 1;

    if v_recent_id is not null then
      return jsonb_build_object(
        'success', true,
        'return_url', case when v_form.return_url_enable then v_form.return_url else null end,
        'message', v_form.success_message,
        'description', v_form.success_description
      );
    end if;
  end if;

  insert into public.leads (
    title, first_name, last_name, email, phone, company_name, country,
    requirements, lead_source, status, lead_owner_id, created_by_id
  ) values (
    'Website Lead', v_first_name, v_last_name, nullif(v_email, ''),
    nullif(v_phone, ''), nullif(v_company, ''),
    coalesce(nullif(v_country, ''), 'India'), nullif(v_requirements, ''),
    'website', 'new', v_owner_id, v_owner_id
  )
  returning id into v_lead_id;

  update public.crm_lead_capture_forms
  set submission_count = submission_count + 1,
      updated_at = now()
  where id = p_form_id;

  v_assignment_res := public.evaluate_and_assign_lead(v_lead_id);

  return jsonb_build_object(
    'success', true,
    'return_url', case when v_form.return_url_enable then v_form.return_url else null end,
    'message', v_form.success_message,
    'description', v_form.success_description
  );
end;
$$;

revoke all on function public.submit_web_to_lead(uuid, jsonb) from public;
grant execute on function public.submit_web_to_lead(uuid, jsonb) to anon, authenticated, service_role;

commit;
