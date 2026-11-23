import type { Database } from '@finlonexa/database';

export type LeadRow = Database['public']['Tables']['leads']['Row'];
export type LeadInsert = Database['public']['Tables']['leads']['Insert'];
export type LeadUpdate = Database['public']['Tables']['leads']['Update'];

export type LeadStatusRow = Database['public']['Tables']['lead_statuses']['Row'];
export type LeadActivityRow = Database['public']['Tables']['lead_activities']['Row'];
export type LeadHistoryRow = Database['public']['Tables']['lead_history']['Row'];

export interface LeadWithRelations extends LeadRow {
  converted_account_id?: string | null;
  converted_contact_id?: string | null;
  converted_opportunity_id?: string | null;
  lead_owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  sub_owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export type ViewMode = 'table' | 'kanban' | 'split' | 'card' | 'chart';
export type ViewType = 'all' | 'recently_viewed' | 'recently_created' | 'converted';

export interface LeadFilterState {
  search: string;
  status: string[];
  source: string[];
  industry: string[];
  ownerId: string | null;
  subOwnerId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  minRevenue?: number | null;
  maxRevenue?: number | null;
}

export interface LeadPaginationState {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface LeadConversionPayload {
  leadId: string;
  accountAction: 'create_new' | 'select_existing';
  accountId?: string | null;
  accountName?: string | null;
  contactAction: 'create_new' | 'select_existing';
  contactId?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  opportunityAction: 'create_new' | 'select_existing';
  opportunityId?: string | null;
  opportunityName?: string | null;
  opportunityAmount?: number | null;
  opportunityCloseDate?: string | null;
  ownerId?: string | null;
}

export const LEAD_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'event', label: 'Event' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'partner', label: 'Partner' },
  { value: 'other', label: 'Other' },
] as const;

export const INDUSTRY_CHOICES = [
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'construction', label: 'Construction' },
  { value: 'banking', label: 'Banking' },
  { value: 'education', label: 'Education' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
] as const;

export const CANONICAL_LEAD_STAGES = [
  { id: 'new', name: 'New', order: 1, probability: 10, isFinal: false, color: '#3b82f6' },
  { id: 'contacted', name: 'Contacted', order: 2, probability: 30, isFinal: false, color: '#8b5cf6' },
  { id: 'qualified', name: 'Qualified', order: 3, probability: 60, isFinal: false, color: '#10b981' },
  { id: 'proposal', name: 'Proposal', order: 4, probability: 80, isFinal: false, color: '#f59e0b' },
  { id: 'lost', name: 'Lost', order: 5, probability: 0, isFinal: false, color: '#ef4444' },
  { id: 'convert', name: 'Convert', order: 6, probability: 100, isFinal: true, color: '#059669' },
] as const;
