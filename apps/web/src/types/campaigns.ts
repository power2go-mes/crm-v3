import type { CampaignRecord, CampaignMemberRecord } from '@finlonexa/database';

export type { CampaignRecord, CampaignMemberRecord };

export type CampaignMemberStatus = 'planned' | 'sent' | 'recieved' | 'responded';
export type CampaignMemberType = 'lead' | 'contact';

export const CAMPAIGN_STATUS_CHOICES = [
  { id: 'new', label: 'New', color: '#64748b' },
  { id: 'planned', label: 'Planned', color: '#3b82f6' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'completed', label: 'Completed', color: '#10b981' },
  { id: 'aborted', label: 'Aborted', color: '#ef4444' },
] as const;

export const CAMPAIGN_TYPE_CHOICES = [
  { id: 'email', label: 'Email' },
  { id: 'event', label: 'Event' },
  { id: 'social_media', label: 'Social Media' },
  { id: 'webinar', label: 'Webinar' },
  { id: 'referral', label: 'Referral' },
  { id: 'advertisement', label: 'Advertisement' },
  { id: 'other', label: 'Other' },
] as const;

export interface CampaignFilterState {
  status: string[];
  campaignType: string[];
  startDateFrom: string | null;
  startDateTo: string | null;
  endDateFrom: string | null;
  endDateTo: string | null;
  minExpectedRevenue: number | null;
  maxExpectedRevenue: number | null;
  minBudgetCost: number | null;
  maxBudgetCost: number | null;
}

export interface CampaignMemberWithDetails extends CampaignMemberRecord {
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
    email: string | null;
  } | null;
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

export interface CampaignWithRelations extends CampaignRecord {
  owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  parent_campaign?: {
    id: string;
    campaign_name: string;
  } | null;
}
