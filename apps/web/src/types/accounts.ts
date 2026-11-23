import type { Database } from '@finlonexa/database';

export type AccountRow = Database['public']['Tables']['accounts']['Row'];
export type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
export type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export const ACCOUNT_SOURCES = [
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

export const ACCOUNT_TYPES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer_direct', label: 'Customer - Direct' },
  { value: 'customer_channel', label: 'Customer - Channel' },
  { value: 'channel_partner_reseller', label: 'Channel Partner / Reseller' },
  { value: 'installation_partner', label: 'Installation Partner' },
  { value: 'technology_partner', label: 'Technology Partner' },
  { value: 'other', label: 'Other' },
] as const;

export const ACCOUNT_INDUSTRIES = [
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'construction', label: 'Construction' },
  { value: 'banking', label: 'Banking' },
  { value: 'education', label: 'Education' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
] as const;

export const ACCOUNT_OWNERSHIP = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'subsidiary', label: 'Subsidiary' },
  { value: 'other', label: 'Other' },
] as const;

export interface AccountFilterState {
  accountTypes: string[];
  industries: string[];
  accountSources: string[];
  ownership: string[];
  ownerId: string | null;
  minRevenue: number | null;
  maxRevenue: number | null;
  createdDateFrom: string | null;
  createdDateTo: string | null;
}

export interface AccountWithRelations extends AccountRow {
  account_owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  contacts_count?: number;
  opportunities_count?: number;
}
