-- Migration: Server-side secure aggregation RPC for dashboard summary
-- Preserves RLS, user hierarchy, and avoids client-side PostgREST row truncation

CREATE OR REPLACE FUNCTION public.get_dashboard_summary_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_leads BIGINT;
    v_active_opps BIGINT;
    v_total_pipeline NUMERIC;
    v_closed_won_revenue NUMERIC;
    v_pending_tasks BIGINT;
BEGIN
    -- All queries run with SECURITY INVOKER under caller's RLS context
    SELECT COUNT(*) INTO v_total_leads FROM public.leads;

    SELECT 
        COUNT(*),
        COALESCE(SUM(amount), 0)
    INTO 
        v_active_opps,
        v_total_pipeline
    FROM public.opportunities
    WHERE LOWER(TRIM(stage)) NOT IN ('closed_lost', 'lost', 'closedlost');

    SELECT 
        COALESCE(SUM(amount), 0)
    INTO 
        v_closed_won_revenue
    FROM public.opportunities
    WHERE LOWER(TRIM(stage)) IN ('closed_won', 'won', 'closedwon');

    SELECT COUNT(*) INTO v_pending_tasks 
    FROM public.activities 
    WHERE activity_type = 'task' 
      AND assigned_to_id = auth.uid() 
      AND status NOT IN ('completed', 'cancelled');

    RETURN jsonb_build_object(
        'totalLeadsInScope', v_total_leads,
        'activeOpportunities', v_active_opps,
        'totalPipelineValue', v_total_pipeline,
        'closedWonRevenue', v_closed_won_revenue,
        'pendingTasks', v_pending_tasks
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary_stats() TO authenticated;
