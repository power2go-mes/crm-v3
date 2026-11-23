'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { ProductRecord, ProductFilterState } from '@/types/products';

export interface UseProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  type?: string;
  status?: 'active' | 'inactive' | 'all';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useProducts(params: UseProductsParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search = '',
    category,
    type,
    status = 'all',
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = params;

  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<{ products: ProductRecord[]; totalCount: number }>({
    queryKey: ['products-list', user?.id, { page, pageSize, search, category, type, status, sortBy, sortOrder }],
    enabled: !authLoading && !!user && !!profile?.is_active && hasPermission('products.view'),
    queryFn: async () => {
      let query = (supabase as any)
        .from('crm_products')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        const term = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
        query = query.or(`name.ilike.${term},sku.ilike.${term},description.ilike.${term}`);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        products: (data as ProductRecord[]) || [],
        totalCount: count || 0,
      };
    },
  });
}

export function useProduct(id?: string | null) {
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<ProductRecord | null>({
    queryKey: ['product-detail', id],
    enabled: !authLoading && !!user && !!profile?.is_active && !!id && hasPermission('products.view'),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('crm_products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ProductRecord;
    },
  });
}

export function useProductUsage(productId?: string | null) {
  const { user, hasPermission } = useAuth();
  const supabase = createClient();

  return useQuery<{ lineItemsCount: number; quotesCount: number }>({
    queryKey: ['product-usage', productId],
    enabled: !!user && !!productId && hasPermission('products.view'),
    queryFn: async () => {
      if (!productId) return { lineItemsCount: 0, quotesCount: 0 };
      const [oppRes, quoteRes] = await Promise.all([
        (supabase as any).from('crm_opportunity_line_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
        (supabase as any).from('crm_quote_line_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      ]);
      return {
        lineItemsCount: oppRes.count || 0,
        quotesCount: quoteRes.count || 0,
      };
    },
  });
}
