/**
 * FINLONEXA CRM v3 — Forecast Utilities & Canonical Stage Definition
 *
 * Approved 7-Stage FINLONEXA CRM Pipeline:
 * 1. Prospecting (10%)
 * 2. Qualification (20%)
 * 3. Needs Analysis (40%)
 * 4. Proposal/Quote (60%)
 * 5. Negotiation (80%)
 * 6. Closed Won (100% - Realized Revenue)
 * 7. Closed Lost (0% - Closed Lost)
 */

export type CanonicalStageId =
  | 'prospecting'
  | 'qualification'
  | 'needs_analysis'
  | 'proposal_quote'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface StageConfig {
  id: CanonicalStageId;
  label: string;
  order: number;
  defaultProbability: number;
  isWon?: boolean;
  isLost?: boolean;
}

export const APPROVED_FORECAST_STAGES: readonly StageConfig[] = [
  { id: 'prospecting', label: 'Prospecting', order: 1, defaultProbability: 10 },
  { id: 'qualification', label: 'Qualification', order: 2, defaultProbability: 20 },
  { id: 'needs_analysis', label: 'Needs Analysis', order: 3, defaultProbability: 40 },
  { id: 'proposal_quote', label: 'Proposal/Quote', order: 4, defaultProbability: 60 },
  { id: 'negotiation', label: 'Negotiation', order: 5, defaultProbability: 80 },
  { id: 'closed_won', label: 'Closed Won', order: 6, defaultProbability: 100, isWon: true },
  { id: 'closed_lost', label: 'Closed Lost', order: 7, defaultProbability: 0, isLost: true },
] as const;

export const STAGE_CONFIG_MAP: Record<CanonicalStageId, StageConfig> = {
  prospecting: APPROVED_FORECAST_STAGES[0],
  qualification: APPROVED_FORECAST_STAGES[1],
  needs_analysis: APPROVED_FORECAST_STAGES[2],
  proposal_quote: APPROVED_FORECAST_STAGES[3],
  negotiation: APPROVED_FORECAST_STAGES[4],
  closed_won: APPROVED_FORECAST_STAGES[5],
  closed_lost: APPROVED_FORECAST_STAGES[6],
};

/**
 * Normalizes any opportunity stage string (including CRM v2 legacy choices,
 * case variations, and punctuation) to one of the 7 canonical stages or 'unassigned'.
 */
export function normalizeOpportunityStage(stage: string | null | undefined): CanonicalStageId | 'unassigned' {
  if (!stage || typeof stage !== 'string') return 'unassigned';
  const clean = stage.trim().toLowerCase().replace(/[\s\-_/.]+/g, '_');

  if (clean === 'prospecting') return 'prospecting';
  if (clean === 'qualification') return 'qualification';
  if (clean === 'needs_analysis' || clean === 'needsanalysis') return 'needs_analysis';
  if (clean.includes('proposal') || clean.includes('quote')) return 'proposal_quote';
  if (clean.includes('negotiat') || clean.includes('review')) return 'negotiation';
  if (clean === 'closed_won' || clean === 'won' || clean === 'closedwon') return 'closed_won';
  if (clean === 'closed_lost' || clean === 'lost' || clean === 'closedlost') return 'closed_lost';

  return 'unassigned';
}

export interface OpportunityForecastItem {
  id: string;
  name: string;
  stage?: string | null;
  amount?: number | string | null;
  probability?: number | null;
  close_date?: string | null;
  owner_id?: string | null;
}

export interface ForecastSummaryStats {
  unweightedPipeline: number;
  weightedPipeline: number;
  closedWonRevenue: number;
  closedLostRevenue: number;
  totalCommitVolume: number;
  openDealsCount: number;
  wonDealsCount: number;
  lostDealsCount: number;
  unassignedDealsCount: number;
  unassignedDealsAmount: number;
  blendedConfidence: number;
}

export interface StageBreakdownItem {
  id: CanonicalStageId;
  label: string;
  defaultProbability: number;
  count: number;
  totalAmount: number;
  weightedAmount: number;
  isWon?: boolean;
  isLost?: boolean;
}

/**
 * Calculates complete forecast statistics across the opportunity population.
 *
 * Rules:
 * 1. Open Pipeline includes only open stages (prospecting, qualification, needs_analysis, proposal_quote, negotiation, plus valid open unassigned).
 * 2. Closed Won is 100% attained revenue and is excluded from open pipeline.
 * 3. Closed Lost is 0% probability and is excluded from open pipeline.
 * 4. Missing/invalid stages are safely categorized as 'unassigned' without throwing errors.
 */
export function calculateForecastStats(opportunities: OpportunityForecastItem[]): {
  summary: ForecastSummaryStats;
  breakdown: StageBreakdownItem[];
} {
  let unweightedPipeline = 0;
  let weightedPipeline = 0;
  let closedWonRevenue = 0;
  let closedLostRevenue = 0;
  let openDealsCount = 0;
  let wonDealsCount = 0;
  let lostDealsCount = 0;
  let unassignedDealsCount = 0;
  let unassignedDealsAmount = 0;

  const stageBuckets: Record<CanonicalStageId, { count: number; totalAmount: number; weightedAmount: number }> = {
    prospecting: { count: 0, totalAmount: 0, weightedAmount: 0 },
    qualification: { count: 0, totalAmount: 0, weightedAmount: 0 },
    needs_analysis: { count: 0, totalAmount: 0, weightedAmount: 0 },
    proposal_quote: { count: 0, totalAmount: 0, weightedAmount: 0 },
    negotiation: { count: 0, totalAmount: 0, weightedAmount: 0 },
    closed_won: { count: 0, totalAmount: 0, weightedAmount: 0 },
    closed_lost: { count: 0, totalAmount: 0, weightedAmount: 0 },
  };

  for (const opp of opportunities) {
    const rawAmt = Number(opp.amount);
    const amount = !isNaN(rawAmt) && rawAmt > 0 ? rawAmt : 0;
    const stageId = normalizeOpportunityStage(opp.stage);

    if (stageId === 'closed_won') {
      closedWonRevenue += amount;
      wonDealsCount++;
      stageBuckets.closed_won.count++;
      stageBuckets.closed_won.totalAmount += amount;
      stageBuckets.closed_won.weightedAmount += amount; // 100%
    } else if (stageId === 'closed_lost') {
      closedLostRevenue += amount;
      lostDealsCount++;
      stageBuckets.closed_lost.count++;
      stageBuckets.closed_lost.totalAmount += amount;
      stageBuckets.closed_lost.weightedAmount += 0; // 0%
    } else if (stageId === 'unassigned') {
      unassignedDealsCount++;
      unassignedDealsAmount += amount;
      // If positive amount, treat as open pipeline with explicit opp probability or 0
      if (amount > 0) {
        const prob = opp.probability != null && !isNaN(Number(opp.probability)) ? Number(opp.probability) : 0;
        unweightedPipeline += amount;
        weightedPipeline += (amount * prob) / 100;
        openDealsCount++;
      }
    } else {
      // One of the 5 active open stages
      openDealsCount++;
      const config = STAGE_CONFIG_MAP[stageId];
      const probability =
        opp.probability != null && !isNaN(Number(opp.probability)) && Number(opp.probability) >= 0
          ? Number(opp.probability)
          : config.defaultProbability;

      const weighted = (amount * probability) / 100;

      unweightedPipeline += amount;
      weightedPipeline += weighted;

      stageBuckets[stageId].count++;
      stageBuckets[stageId].totalAmount += amount;
      stageBuckets[stageId].weightedAmount += weighted;
    }
  }

  const totalCommitVolume = closedWonRevenue + weightedPipeline;
  const blendedConfidence = unweightedPipeline > 0 ? (weightedPipeline / unweightedPipeline) * 100 : 0;

  const breakdown: StageBreakdownItem[] = APPROVED_FORECAST_STAGES.map((cfg) => ({
    id: cfg.id,
    label: cfg.label,
    defaultProbability: cfg.defaultProbability,
    count: stageBuckets[cfg.id].count,
    totalAmount: stageBuckets[cfg.id].totalAmount,
    weightedAmount: stageBuckets[cfg.id].weightedAmount,
    isWon: cfg.isWon,
    isLost: cfg.isLost,
  }));

  return {
    summary: {
      unweightedPipeline,
      weightedPipeline,
      closedWonRevenue,
      closedLostRevenue,
      totalCommitVolume,
      openDealsCount,
      wonDealsCount,
      lostDealsCount,
      unassignedDealsCount,
      unassignedDealsAmount,
      blendedConfidence,
    },
    breakdown,
  };
}
