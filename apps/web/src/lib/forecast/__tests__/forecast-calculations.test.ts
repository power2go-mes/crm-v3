import { describe, it, expect } from 'vitest';
import {
  APPROVED_FORECAST_STAGES,
  normalizeOpportunityStage,
  calculateForecastStats,
  type OpportunityForecastItem,
} from '../forecast-utils';

describe('FINLONEXA CRM v3 — Forecast Stage Consistency & Calculations', () => {
  it('1. verifies the approved 7-stage pipeline configuration', () => {
    expect(APPROVED_FORECAST_STAGES).toHaveLength(7);
    const stageIds = APPROVED_FORECAST_STAGES.map((s) => s.id);
    expect(stageIds).toEqual([
      'prospecting',
      'qualification',
      'needs_analysis',
      'proposal_quote',
      'negotiation',
      'closed_won',
      'closed_lost',
    ]);

    const stageLabels = APPROVED_FORECAST_STAGES.map((s) => s.label);
    expect(stageLabels).toEqual([
      'Prospecting',
      'Qualification',
      'Needs Analysis',
      'Proposal/Quote',
      'Negotiation',
      'Closed Won',
      'Closed Lost',
    ]);

    const probabilities = APPROVED_FORECAST_STAGES.map((s) => s.defaultProbability);
    expect(probabilities).toEqual([10, 20, 40, 60, 80, 100, 0]);
  });

  it('2. correctly normalizes Title Case, snake_case, and legacy stage representations', () => {
    // Prospecting
    expect(normalizeOpportunityStage('Prospecting')).toBe('prospecting');
    expect(normalizeOpportunityStage('prospecting')).toBe('prospecting');

    // Qualification
    expect(normalizeOpportunityStage('Qualification')).toBe('qualification');
    expect(normalizeOpportunityStage('qualification')).toBe('qualification');

    // Needs Analysis
    expect(normalizeOpportunityStage('Needs Analysis')).toBe('needs_analysis');
    expect(normalizeOpportunityStage('needs_analysis')).toBe('needs_analysis');

    // Proposal/Quote & CRM v2 variants
    expect(normalizeOpportunityStage('Proposal/Quote')).toBe('proposal_quote');
    expect(normalizeOpportunityStage('proposal_quote')).toBe('proposal_quote');
    expect(normalizeOpportunityStage('Proposal/Price Quote')).toBe('proposal_quote');

    // Negotiation & CRM v2 variants
    expect(normalizeOpportunityStage('Negotiation')).toBe('negotiation');
    expect(normalizeOpportunityStage('negotiation')).toBe('negotiation');
    expect(normalizeOpportunityStage('Negotiation/Review')).toBe('negotiation');

    // Closed Won
    expect(normalizeOpportunityStage('Closed Won')).toBe('closed_won');
    expect(normalizeOpportunityStage('closed_won')).toBe('closed_won');
    expect(normalizeOpportunityStage('Won')).toBe('closed_won');

    // Closed Lost
    expect(normalizeOpportunityStage('Closed Lost')).toBe('closed_lost');
    expect(normalizeOpportunityStage('closed_lost')).toBe('closed_lost');
    expect(normalizeOpportunityStage('Lost')).toBe('closed_lost');
  });

  it('3. safely handles missing, empty, or invalid stage data', () => {
    expect(normalizeOpportunityStage(null)).toBe('unassigned');
    expect(normalizeOpportunityStage(undefined)).toBe('unassigned');
    expect(normalizeOpportunityStage('')).toBe('unassigned');
    expect(normalizeOpportunityStage('   ')).toBe('unassigned');
    expect(normalizeOpportunityStage('NonExistentStage')).toBe('unassigned');
  });

  it('4. calculates aggregations, excluding Closed Won and Closed Lost from open pipeline', () => {
    const opportunities: OpportunityForecastItem[] = [
      { id: '1', name: 'Deal 1', stage: 'Prospecting', amount: 100000, probability: 10 },
      { id: '2', name: 'Deal 2', stage: 'Qualification', amount: 50000, probability: 20 },
      { id: '3', name: 'Deal 3', stage: 'Needs Analysis', amount: 100000, probability: null }, // Fallback to 40%
      { id: '4', name: 'Deal 4', stage: 'Proposal/Quote', amount: 80000, probability: 60 },
      { id: '5', name: 'Deal 5', stage: 'Negotiation', amount: 200000, probability: 80 },
      { id: '6', name: 'Deal 6', stage: 'Closed Won', amount: 300000, probability: 100 },
      { id: '7', name: 'Deal 7', stage: 'Closed Lost', amount: 150000, probability: 0 },
    ];

    const { summary, breakdown } = calculateForecastStats(opportunities);

    // Open deals are Deals 1-5
    // unweightedPipeline = 100,000 + 50,000 + 100,000 + 80,000 + 200,000 = 530,000
    expect(summary.unweightedPipeline).toBe(530000);
    expect(summary.openDealsCount).toBe(5);

    // weightedPipeline:
    // Deal 1: 100,000 * 10% = 10,000
    // Deal 2: 50,000 * 20% = 10,000
    // Deal 3: 100,000 * 40% (default) = 40,000
    // Deal 4: 80,000 * 60% = 48,000
    // Deal 5: 200,000 * 80% = 160,000
    // Total weighted: 10,000 + 10,000 + 40,000 + 48,000 + 160,000 = 268,000
    expect(summary.weightedPipeline).toBe(268000);

    // Closed Won: 300,000 (NOT in open pipeline)
    expect(summary.closedWonRevenue).toBe(300000);
    expect(summary.wonDealsCount).toBe(1);

    // Closed Lost: 150,000 (NOT in open pipeline or weighted)
    expect(summary.closedLostRevenue).toBe(150000);
    expect(summary.lostDealsCount).toBe(1);

    // Total commit volume: Closed Won (300,000) + Weighted Open (268,000) = 568,000
    expect(summary.totalCommitVolume).toBe(568000);

    // Blended confidence: 268,000 / 530,000 * 100 = ~50.566%
    expect(summary.blendedConfidence).toBeCloseTo(50.57, 1);

    // 7-Stage Breakdown counts and amounts
    expect(breakdown).toHaveLength(7);
    const prospecting = breakdown.find((b) => b.id === 'prospecting')!;
    expect(prospecting.count).toBe(1);
    expect(prospecting.totalAmount).toBe(100000);
    expect(prospecting.weightedAmount).toBe(10000);

    const won = breakdown.find((b) => b.id === 'closed_won')!;
    expect(won.count).toBe(1);
    expect(won.totalAmount).toBe(300000);
    expect(won.weightedAmount).toBe(300000);

    const lost = breakdown.find((b) => b.id === 'closed_lost')!;
    expect(lost.count).toBe(1);
    expect(lost.totalAmount).toBe(150000);
    expect(lost.weightedAmount).toBe(0);
  });

  it('5. gracefully handles corrupted, zero-amount, and unassigned records without NaN', () => {
    const corruptData: OpportunityForecastItem[] = [
      { id: '1', name: 'Corrupt 1', stage: null, amount: null, probability: null },
      { id: '2', name: 'Corrupt 2', stage: '', amount: 'invalid', probability: NaN },
      { id: '3', name: 'Unassigned Deal', stage: 'RandomCustomStage', amount: 50000, probability: 50 },
      { id: '4', name: 'Zero Deal', stage: 'prospecting', amount: 0, probability: 10 },
    ];

    const { summary } = calculateForecastStats(corruptData);

    expect(isNaN(summary.unweightedPipeline)).toBe(false);
    expect(isNaN(summary.weightedPipeline)).toBe(false);
    expect(isNaN(summary.closedWonRevenue)).toBe(false);
    expect(isNaN(summary.blendedConfidence)).toBe(false);

    // The unassigned deal with positive amount is tracked safely
    expect(summary.unassignedDealsCount).toBe(3);
    expect(summary.unassignedDealsAmount).toBe(50000);
    expect(summary.unweightedPipeline).toBe(50000);
    expect(summary.weightedPipeline).toBe(25000); // 50,000 * 50%
  });
});
