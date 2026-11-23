import type { Database } from '@finlonexa/database';

export type ContactRow = Database['public']['Tables']['contacts']['Row'];
export type ContactInsert = Database['public']['Tables']['contacts']['Insert'];
export type ContactUpdate = Database['public']['Tables']['contacts']['Update'];

export const CONTACT_SOURCES = [
  { value: 'web', label: 'Web' },
  { value: 'phone_inquiry', label: 'Phone Inquiry' },
  { value: 'partner_referral', label: 'Partner Referral' },
  { value: 'purchased_list', label: 'Purchased List' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
] as const;

export interface ContactFilterState {
  sources: string[];
  isPrimary: boolean | null;
  ownerId: string | null;
  accountId: string | null;
  createdDateFrom: string | null;
  createdDateTo: string | null;
}

export interface ContactWithRelations extends ContactRow {
  account?: {
    id: string;
    name: string;
  } | null;
  parent_contact?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  contact_owner?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface SaveContactInput {
  id?: string;
  first_name: string;
  last_name: string;
  email: string | null;
  title?: string | null;
  contact_number?: string | null;
  secondary_contact_number?: string | null;
  parent_contact_id?: string | null;
  is_primary?: boolean;
  account_id?: string | null;
  relationships?: Array<{ account_id: string; role_id?: string | null }>;
}
