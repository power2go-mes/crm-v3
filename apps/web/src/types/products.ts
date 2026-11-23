export type ProductType = 'product' | 'service' | 'subscription';

export interface ProductRecord {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string;
  type: ProductType;
  unit_of_measure: string;
  default_price: number;
  currency: string;
  tax_category: string | null;
  tax_rate: number;
  is_active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductInsert = Omit<ProductRecord, 'id' | 'created_at' | 'updated_at'>;
export type ProductUpdate = Partial<ProductInsert>;

export interface PriceBookRecord {
  id: string;
  name: string;
  description: string | null;
  is_standard: boolean;
  is_active: boolean;
  currency: string;
  effective_from: string | null;
  effective_to: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  entries_count?: number;
}

export type PriceBookInsert = Omit<PriceBookRecord, 'id' | 'created_at' | 'updated_at' | 'entries_count'>;
export type PriceBookUpdate = Partial<PriceBookInsert>;

export interface PriceBookEntryRecord {
  id: string;
  price_book_id: string;
  product_id: string;
  unit_price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: ProductRecord;
}

export type PriceBookEntryInsert = Omit<PriceBookEntryRecord, 'id' | 'created_at' | 'updated_at' | 'product'>;

export interface ProductFilterState {
  search?: string;
  category?: string;
  type?: ProductType | 'all';
  status?: 'active' | 'inactive' | 'all';
  currency?: string;
}
