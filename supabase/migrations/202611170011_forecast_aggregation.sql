-- =============================================================================
-- FINLONEXA CRM v3 — Migration 202611170011: Database-Side Forecast Aggregation
-- =============================================================================
-- Replaces client-side full opportunity fetching with an authenticated,
-- RLS-scoped database aggregation RPC that calculates 7-stage pipeline distribution,
-- weighted forecast attainment, open/won/lost boundaries, and unassigned amounts.

begin;

create or replace function public.forecast_pipeline_metrics(
  date_from date default null,
  date_to date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_summary jsonb;
  v_breakdown jsonb;
begin
  -- 1. Security Check: Enforce role-based permission
  if not public.has_effective_permission(auth.uid(), 'opportunities.view') then
    raise exception 'Opportunities view permission denied' using errcode = '42501';
  end if;

  -- 2. Date Range Validation
  if date_from is not null and date_to is not null and date_from > date_to then
    raise exception 'Invalid date range: date_from cannot be greater than date_to' using errcode = '22023';
  end if;

  -- 3. Execute aggregate computation over RLS-filtered opportunities
  with normalized_opps as (
    select
      id,
      name,
      coalesce(amount, 0)::numeric as amount,
      probability::numeric as probability,
      close_date,
      case
        when stage is null or btrim(stage) = '' then 'unassigned'
        else
          case
            when lower(regexp_replace(btrim(stage), '[\s\-_/.]+', '_', 'g')) in ('prospecting') then 'prospecting'
            when lower(regexp_replace(btrim(stage), '[\s\-_/.]+', '_', 'g')) in ('qualification') then 'qualification'
            when lower(regexp_replace(btrim(stage), '[\s\-_/.]+', '_', 'g')) in ('needs_analysis', 'needsanalysis') then 'needs_analysis'
            when lower(stage) like '%proposal%' or lower(stage) like '%quote%' then 'proposal_quote'
            when lower(stage) like '%negotiat%' or lower(stage) like '%review%' then 'negotiation'
            when lower(regexp_replace(btrim(stage), '[\s\-_/.]+', '_', 'g')) in ('closed_won', 'won', 'closedwon') then 'closed_won'
            when lower(regexp_replace(btrim(stage), '[\s\-_/.]+', '_', 'g')) in ('closed_lost', 'lost', 'closedlost') then 'closed_lost'
            else 'unassigned'
          end
      end as canonical_stage
    from public.opportunities
    where (date_from is null or close_date >= date_from)
      and (date_to is null or close_date <= date_to)
  ),
  classified_opps as (
    select
      canonical_stage,
      amount,
      case
        when canonical_stage = 'prospecting' then coalesce(case when probability >= 0 then probability end, 10)
        when canonical_stage = 'qualification' then coalesce(case when probability >= 0 then probability end, 20)
        when canonical_stage = 'needs_analysis' then coalesce(case when probability >= 0 then probability end, 40)
        when canonical_stage = 'proposal_quote' then coalesce(case when probability >= 0 then probability end, 60)
        when canonical_stage = 'negotiation' then coalesce(case when probability >= 0 then probability end, 80)
        when canonical_stage = 'closed_won' then 100
        when canonical_stage = 'closed_lost' then 0
        else coalesce(case when probability >= 0 then probability end, 0)
      end as eff_probability,
      case
        when canonical_stage = 'closed_won' then amount
        when canonical_stage = 'closed_lost' then 0
        when canonical_stage = 'unassigned' then (amount * coalesce(case when probability >= 0 then probability end, 0)) / 100
        else (amount * coalesce(case when probability >= 0 then probability end,
          case
            when canonical_stage = 'prospecting' then 10
            when canonical_stage = 'qualification' then 20
            when canonical_stage = 'needs_analysis' then 40
            when canonical_stage = 'proposal_quote' then 60
            when canonical_stage = 'negotiation' then 80
            else 0
          end
        )) / 100
      end as weighted_amount
    from normalized_opps
  ),
  summary_calc as (
    select
      coalesce(sum(case when canonical_stage in ('prospecting', 'qualification', 'needs_analysis', 'proposal_quote', 'negotiation', 'unassigned') and amount > 0 then amount else 0 end), 0) as unweighted_pipeline,
      coalesce(sum(case when canonical_stage in ('prospecting', 'qualification', 'needs_analysis', 'proposal_quote', 'negotiation', 'unassigned') and amount > 0 then weighted_amount else 0 end), 0) as weighted_pipeline,
      coalesce(sum(case when canonical_stage = 'closed_won' then amount else 0 end), 0) as closed_won_revenue,
      coalesce(sum(case when canonical_stage = 'closed_lost' then amount else 0 end), 0) as closed_lost_revenue,
      coalesce(count(*) filter (where canonical_stage in ('prospecting', 'qualification', 'needs_analysis', 'proposal_quote', 'negotiation') or (canonical_stage = 'unassigned' and amount > 0)), 0) as open_deals_count,
      coalesce(count(*) filter (where canonical_stage = 'closed_won'), 0) as won_deals_count,
      coalesce(count(*) filter (where canonical_stage = 'closed_lost'), 0) as lost_deals_count,
      coalesce(count(*) filter (where canonical_stage = 'unassigned'), 0) as unassigned_deals_count,
      coalesce(sum(case when canonical_stage = 'unassigned' then amount else 0 end), 0) as unassigned_deals_amount
    from classified_opps
  ),
  stage_master (stage_id, label, stage_order, default_prob, is_won, is_lost) as (
    values
      ('prospecting', 'Prospecting', 1, 10, false, false),
      ('qualification', 'Qualification', 2, 20, false, false),
      ('needs_analysis', 'Needs Analysis', 3, 40, false, false),
      ('proposal_quote', 'Proposal/Quote', 4, 60, false, false),
      ('negotiation', 'Negotiation', 5, 80, false, false),
      ('closed_won', 'Closed Won', 6, 100, true, false),
      ('closed_lost', 'Closed Lost', 7, 0, false, true)
  ),
  stage_aggs as (
    select
      m.stage_id,
      m.label,
      m.stage_order,
      m.default_prob,
      m.is_won,
      m.is_lost,
      coalesce(count(c.canonical_stage), 0) as deal_count,
      coalesce(sum(c.amount), 0) as total_amount,
      coalesce(sum(c.weighted_amount), 0) as weighted_amount
    from stage_master m
    left join classified_opps c on c.canonical_stage = m.stage_id
    group by m.stage_id, m.label, m.stage_order, m.default_prob, m.is_won, m.is_lost
    order by m.stage_order
  )
  select
    jsonb_build_object(
      'unweighted_pipeline', round(unweighted_pipeline, 2),
      'weighted_pipeline', round(weighted_pipeline, 2),
      'closed_won_revenue', round(closed_won_revenue, 2),
      'closed_lost_revenue', round(closed_lost_revenue, 2),
      'total_commit_volume', round(closed_won_revenue + weighted_pipeline, 2),
      'open_deals_count', open_deals_count,
      'won_deals_count', won_deals_count,
      'lost_deals_count', lost_deals_count,
      'unassigned_deals_count', unassigned_deals_count,
      'unassigned_deals_amount', round(unassigned_deals_amount, 2),
      'blended_confidence', case when unweighted_pipeline > 0 then round((weighted_pipeline / unweighted_pipeline) * 100, 2) else 0 end
    ),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', stage_id,
        'label', label,
        'default_probability', default_prob,
        'count', deal_count,
        'total_amount', round(total_amount, 2),
        'weighted_amount', round(weighted_amount, 2),
        'is_won', is_won,
        'is_lost', is_lost
      ) order by stage_order
    ), '[]'::jsonb)
  into v_summary, v_breakdown
  from summary_calc
  cross join stage_aggs
  group by
    unweighted_pipeline,
    weighted_pipeline,
    closed_won_revenue,
    closed_lost_revenue,
    open_deals_count,
    won_deals_count,
    lost_deals_count,
    unassigned_deals_count,
    unassigned_deals_amount;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'breakdown', coalesce(v_breakdown, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.forecast_pipeline_metrics(date, date) from public, anon;
grant execute on function public.forecast_pipeline_metrics(date, date) to authenticated;

commit;
