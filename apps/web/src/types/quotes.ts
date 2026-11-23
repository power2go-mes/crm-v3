import type { ProductRecord } from './products';

export interface OpportunityLineItemRecord {
  id: string;
  opportunity_id: string;
  product_id: string;
  price_book_entry_id: string | null;
  product_name: string;
  product_sku: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product?: ProductRecord;
}

export type OpportunityLineItemInsert = Omit<OpportunityLineItemRecord, 'id' | 'created_at' | 'updated_at' | 'product'>;
export type OpportunityLineItemUpdate = Partial<OpportunityLineItemInsert>;

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface QuoteRecord {
  id: string;
  quote_number: string;
  opportunity_id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
  subject: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  billing_address: string | null;
  shipping_address: string | null;
  terms_and_conditions: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  current_revision: number;
  created_at: string;
  updated_at: string;
  opportunity?: { id: string; name: string };
  account?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string; email: string | null } | null;
}

export type QuoteInsert = Omit<QuoteRecord, 'id' | 'quote_number' | 'current_revision' | 'created_at' | 'updated_at' | 'opportunity' | 'account' | 'contact'>;
export type QuoteUpdate = Partial<QuoteInsert>;

export interface QuoteLineItemRecord {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type QuoteLineItemInsert = Omit<QuoteLineItemRecord, 'id' | 'created_at' | 'updated_at'>;

export interface QuoteRevisionRecord {
  id: string;
  quote_id: string;
  revision_number: number;
  snapshot_data: {
    quote: QuoteRecord;
    items: QuoteLineItemRecord[];
    company: Record<string, any>;
    snapshot_at: string;
    revision: number;
  };
  created_by_id: string | null;
  created_at: string;
}
