'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { PriceBookRecord, PriceBookEntryRecord } from '@/types/products';

export function usePriceBooks() {
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<PriceBookRecord[]>({
    queryKey: ['price-books-list', user?.id],
    enabled: !authLoading && !!user && !!profile?.is_active && hasPermission('price_books.view'),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_price_books')
        .select('*')
        .order('is_standard', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data as PriceBookRecord[]) || [];
    },
  });
}

export function usePriceBookEntries(priceBookId?: string | null) {
  const { user, profile, hasPermission, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  return useQuery<PriceBookEntryRecord[]>({
    queryKey: ['price-book-entries', priceBookId],
    enabled: !authLoading && !!user && !!profile?.is_active && !!priceBookId && hasPermission('price_books.view'),
    queryFn: async () => {
      if (!priceBookId) return [];

      const { data, error } = await (supabase as any)
        .from('crm_price_book_entries')
        .select(`
          *,
          product:crm_products(id, name, sku, category, type, unit_of_measure, default_price, currency, is_active)
        `)
        .eq('price_book_id', priceBookId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as PriceBookEntryRecord[]) || [];
    },
  });
}
