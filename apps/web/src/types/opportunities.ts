import type { Database } from '@finlonexa/database';

export type OpportunityRow = Database['public']['Tables']['opportunities']['Row'];
export type OpportunityInsert = Database['public']['Tables']['opportunities']['Insert'];
export type OpportunityUpdate = Database['public']['Tables']['opportunities']['Update'];

export interface OpportunityStageConfig {
  id: string;
  name: string;
  order: number;
  probability: number;
  color: string;
  isWon?: boolean;
  isLost?: boolean;
}

export const APPROVED_OPPORTUNITY_STAGES: readonly OpportunityStageConfig[] = [
  { id: 'prospecting', name: 'Prospecting', order: 1, probability: 10, color: '#3b82f6' },
  { id: 'qualification', name: 'Qualification', order: 2, probability: 20, color: '#8b5cf6' },
  { id: 'needs_analysis', name: 'Needs Analysis', order: 3, probability: 40, color: '#6366f1' },
  { id: 'proposal_quote', name: 'Proposal/Quote', order: 4, probability: 60, color: '#f59e0b' },
  { id: 'negotiation', name: 'Negotiation', order: 5, probability: 80, color: '#ec4899' },
  { id: 'closed_won', name: 'Closed Won', order: 6, probability: 100, color: '#10b981', isWon: true },
  { id: 'closed_lost', name: 'Closed Lost', order: 7, probability: 0, color: '#ef4444', isLost: true },
] as const;

export const OPPORTUNITY_TYPES = [
  { id: 'existing_customer_upgrade', label: 'Existing Customer - Upgrade' },
  { id: 'existing_customer_replacement', label: 'Existing Customer - Replacement' },
  { id: 'existing_customer_downgrade', label: 'Existing Customer - Downgrade' },
  { id: 'new_customer', label: 'New Customer' },
] as const;

export const OPPORTUNITY_LEAD_SOURCES = [
  { id: 'website', label: 'Website' },
  { id: 'referral', label: 'Referral' },
  { id: 'event', label: 'Event' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'social media', label: 'Social Media' },
  { id: 'partner', label: 'Partner' },
  { id: 'other', label: 'Other' },
] as const;

export interface OpportunityFilterState {
  stages: string[];
  opportunityTypes: string[];
  leadSources: string[];
  ownerId: string | null;
  closeDateFrom: string | null;
  closeDateTo: string | null;
  minAmount: number | null;
  maxAmount: number | null;
}

export const CLOSED_LOST_REASONS = [
  { id: 'price', label: 'Price / Budget Constraints' },
  { id: 'competitor', label: 'Lost to Competitor' },
  { id: 'missing_features', label: 'Missing Product Features' },
  { id: 'unresponsive', label: 'Customer Unresponsive / Ghosted' },
  { id: 'budget', label: 'Budget Reallocated or Frozen' },
  { id: 'cancelled', label: 'Project Cancelled by Client' },
  { id: 'timing', label: 'Poor Timing / Deferred' },
  { id: 'other', label: 'Other Reason' },
] as const;

export interface OpportunityLossHistoryEntry {
  id: string;
  opportunity_id: string;
  lost_reason: string;
  lost_reason_details?: string | null;
  competitor_name?: string | null;
  closed_at: string;
  closed_by_id?: string | null;
  reopened_at?: string | null;
  reopened_by_id?: string | null;
  reopen_reason?: string | null;
  created_at: string;
}

export interface OpportunityWithRelations extends OpportunityRow {
  currency?: string | null;
  price_sync_mode?: 'manual' | 'synced' | null;
  price_book_id?: string | null;
  items_subtotal?: number | null;
  items_discount?: number | null;
  items_tax?: number | null;
  lost_reason?: string | null;
  lost_reason_details?: string | null;
  competitor_name?: string | null;
  closed_at?: string | null;
  closed_by_id?: string | null;
  next_step?: string | null;
  next_activity_date?: string | null;
  stage_entered_at?: string | null;
  opportunity_age_days?: number;
  days_in_stage?: number;
  is_stalled?: boolean;
  account?: {
    id: string;
    name: string;
  } | null;
  owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}
