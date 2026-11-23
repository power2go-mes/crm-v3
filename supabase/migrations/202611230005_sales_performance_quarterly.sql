-- ============================================================================
-- Migration: 202611230005_sales_performance_quarterly.sql
-- Description: Fix get_sales_performance_leaderboard period boundaries
-- Supports monthly, quarterly, and yearly default date calculations
-- Normalizes canonical opportunity stage matching ('closed_won', 'Closed Won')
-- Applies period multiplier for role fallback quotas (quarterly: 3x, yearly: 12x)
-- Preserves SECURITY DEFINER, search_path, and permission enforcement
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_sales_performance_leaderboard(
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_period_type text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
  v_type text := coalesce(nullif(trim(p_period_type), ''), 'monthly');
  v_start date := coalesce(
    p_period_start,
    CASE
      WHEN v_type = 'quarterly' THEN date_trunc('quarter', current_date)::date
      WHEN v_type = 'yearly' THEN date_trunc('year', current_date)::date
      ELSE date_trunc('month', current_date)::date
    END
  );
  v_end date := coalesce(
    p_period_end,
    CASE
      WHEN v_type = 'quarterly' THEN (date_trunc('quarter', current_date) + interval '3 months - 1 day')::date
      WHEN v_type = 'yearly' THEN (date_trunc('year', current_date) + interval '1 year - 1 day')::date
      ELSE (date_trunc('month', current_date) + interval '1 month - 1 day')::date
    END
  );
  v_period_multiplier numeric := CASE
    WHEN v_type = 'quarterly' THEN 3.0
    WHEN v_type = 'yearly' THEN 12.0
    ELSE 1.0
  END;
BEGIN
  -- Permission check
  IF auth.uid() IS NOT NULL AND NOT public.has_effective_permission(auth.uid(), 'sales_performance.view') THEN
    RAISE EXCEPTION 'Permission denied: sales_performance.view required' USING errcode = '42501';
  END IF;

  WITH user_base AS (
    SELECT
      u.id,
      btrim(concat(u.first_name, ' ', u.last_name)) AS full_name,
      u.email,
      u.department,
      u.designation,
      r.name AS role_name,
      r.id AS role_id,
      coalesce(r.hierarchy_rank, 999) AS hierarchy_rank,
      btrim(concat(m.first_name, ' ', m.last_name)) AS manager_name
    FROM public.user_profiles u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    LEFT JOIN public.roles r ON r.id = ur.role_id
    LEFT JOIN public.sales_reporting_relationships srr ON srr.user_id = u.id
    LEFT JOIN public.user_profiles m ON m.id = srr.manager_id
    WHERE u.is_active = true
  ),
  -- Calculate deal allocations preventing double-counting via team splits
  opp_split_allocations AS (
    SELECT
      coalesce(tm.user_id, o.owner_id) AS assigned_user_id,
      o.id AS opportunity_id,
      lower(trim(o.stage)) AS stage,
      CASE
        -- If team members exist, allocate proportional split percentage
        WHEN tm.split_percentage IS NOT NULL THEN round((coalesce(o.amount, 0) * (tm.split_percentage / 100.0)), 2)
        -- Otherwise 100% to opportunity owner
        ELSE coalesce(o.amount, 0)
      END AS allocated_amount
    FROM public.opportunities o
    LEFT JOIN public.opportunity_team_members tm ON tm.opportunity_id = o.id
    WHERE (o.close_date >= v_start AND o.close_date <= v_end)
  ),
  user_metrics AS (
    SELECT
      ub.id AS user_id,
      coalesce(sum(CASE WHEN osa.stage IN ('closed_won', 'closed won') THEN osa.allocated_amount ELSE 0 END), 0) AS won_revenue,
      count(DISTINCT CASE WHEN osa.stage IN ('closed_won', 'closed won') THEN osa.opportunity_id END) AS won_deals_count,
      coalesce(sum(CASE WHEN osa.stage NOT IN ('closed_won', 'closed won', 'closed_lost', 'closed lost') THEN osa.allocated_amount ELSE 0 END), 0) AS open_pipeline_value,
      count(DISTINCT CASE WHEN osa.stage NOT IN ('closed_won', 'closed won', 'closed_lost', 'closed lost') THEN osa.opportunity_id END) AS open_deals_count
    FROM user_base ub
    LEFT JOIN opp_split_allocations osa ON osa.assigned_user_id = ub.id
    GROUP BY ub.id
  ),
  user_quotas AS (
    SELECT
      ub.id AS user_id,
      coalesce(
        sq.target_amount,
        -- Fallback default quota by role scaled by period duration if not explicitly configured
        round(
          CASE ub.role_name
            WHEN 'BDO' THEN 50000.00
            WHEN 'ASM' THEN 150000.00
            WHEN 'SSM' THEN 350000.00
            WHEN 'RSM' THEN 750000.00
            WHEN 'HEAD_OF_SALES' THEN 2000000.00
            WHEN 'SUPER_ADMIN' THEN 2500000.00
            ELSE 50000.00
          END * v_period_multiplier,
          2
        )
      ) AS quota_amount,
      sq.id AS quota_id,
      sq.currency AS quota_currency
    FROM user_base ub
    LEFT JOIN public.crm_sales_quotas sq
      ON sq.user_id = ub.id
     AND sq.period_type = v_type
     AND sq.period_start = v_start
  ),
  leaderboard_items AS (
    SELECT
      ub.id,
      ub.full_name AS name,
      ub.email,
      ub.role_id AS "roleId",
      ub.role_name AS "roleName",
      ub.hierarchy_rank AS "hierarchyRank",
      ub.department,
      ub.designation,
      ub.manager_name AS "managerName",
      um.won_revenue AS "wonRevenue",
      um.won_deals_count AS "wonDealsCount",
      um.open_pipeline_value AS "openPipelineValue",
      um.open_deals_count AS "openDealsCount",
      uq.quota_amount AS "quota",
      uq.quota_id AS "quotaId",
      CASE
        WHEN uq.quota_amount > 0 THEN round((um.won_revenue / uq.quota_amount) * 100.0, 2)
        ELSE 0.00
      END AS "attainmentPercent"
    FROM user_base ub
    JOIN user_metrics um ON um.user_id = ub.id
    JOIN user_quotas uq ON uq.user_id = ub.id
    ORDER BY "attainmentPercent" DESC, "wonRevenue" DESC
  ),
  summary_stats AS (
    SELECT
      coalesce(sum("wonRevenue"), 0) AS total_team_won,
      coalesce(sum("quota"), 0) AS total_team_quota,
      CASE
        WHEN sum("quota") > 0 THEN round((sum("wonRevenue") / sum("quota")) * 100.0, 2)
        ELSE 0.00
      END AS overall_attainment,
      coalesce(sum("openPipelineValue"), 0) AS total_open_pipeline,
      count(*) AS active_reps_count
    FROM leaderboard_items
  )
  SELECT jsonb_build_object(
    'period_start', v_start,
    'period_end', v_end,
    'period_type', v_type,
    'totalTeamWon', s.total_team_won,
    'totalTeamQuota', s.total_team_quota,
    'overallAttainment', s.overall_attainment,
    'totalOpenPipeline', s.total_open_pipeline,
    'activeRepsCount', s.active_reps_count,
    'reps', coalesce(jsonb_agg(li.*), '[]'::jsonb),
    'topPerformer', (SELECT to_jsonb(li_first.*) FROM leaderboard_items li_first LIMIT 1)
  ) INTO v_result
  FROM summary_stats s
  CROSS JOIN leaderboard_items li
  GROUP BY s.total_team_won, s.total_team_quota, s.overall_attainment, s.total_open_pipeline, s.active_reps_count;

  RETURN coalesce(v_result, jsonb_build_object(
    'period_start', v_start,
    'period_end', v_end,
    'period_type', v_type,
    'totalTeamWon', 0,
    'totalTeamQuota', 0,
    'overallAttainment', 0,
    'totalOpenPipeline', 0,
    'activeRepsCount', 0,
    'reps', '[]'::jsonb,
    'topPerformer', null
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_performance_leaderboard(date, date, text) TO authenticated, service_role;

COMMIT;
