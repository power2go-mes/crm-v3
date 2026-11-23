'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calculateLineItem } from '@/lib/pricing/calculations';

const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid(),
  product_id: z.string().uuid(),
  price_book_entry_id: z.string().uuid().optional().nullable(),
  product_name: z.string().trim().min(1).max(200).optional(),
  product_sku: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Unit price must be 0 or greater'),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  tax_percent: z.coerce.number().min(0).max(100).default(0),
  sort_order: z.coerce.number().int().default(0),
});

export async function saveOpportunityLineItem(
  oppId: string,
  raw: unknown
): Promise<{ id?: string; error?: string }> {
  const parsed = lineItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid item input' };
  }

  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  // Check access to opportunity
  const canEdit = await client.rpc('can_access_opportunity', {
    p_opp_id: oppId,
    p_level: 'edit',
  });
  if (canEdit.error || canEdit.data !== true) {
    return { error: 'Permission denied to edit products on this opportunity' };
  }

  const input = parsed.data;

  // Retrieve product details for historical snapshot
  const productRes = await client
    .from('crm_products')
    .select('name, sku, default_price')
    .eq('id', input.product_id)
    .single();

  if (productRes.error || !productRes.data) {
    return { error: 'Selected product not found' };
  }

  const productName = input.product_name || productRes.data.name;
  const productSku = input.product_sku || productRes.data.sku;

  // Authoritative calculations
  const calc = calculateLineItem(
    input.quantity,
    input.unit_price,
    input.discount_percent,
    input.tax_percent
  );

  const payload = {
    opportunity_id: oppId,
    product_id: input.product_id,
    price_book_entry_id: input.price_book_entry_id || null,
    product_name: productName,
    product_sku: productSku,
    description: input.description || null,
    quantity: calc.quantity,
    unit_price: calc.unitPrice,
    discount_percent: calc.discountPercent,
    discount_amount: calc.discountAmount,
    tax_percent: calc.taxPercent,
    tax_amount: calc.taxAmount,
    line_total: calc.lineTotal,
    sort_order: input.sort_order,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await client
      .from('crm_opportunity_line_items')
      .update(payload)
      .eq('id', input.id)
      .eq('opportunity_id', oppId);

    if (error) return { error: error.message };
    return { id: input.id };
  } else {
    const { data, error } = await client
      .from('crm_opportunity_line_items')
      .insert(payload)
      .select('id')
      .single();

    if (error) return { error: error.message };
    return { id: data.id };
  }
}

export async function deleteOpportunityLineItem(
  lineItemId: string,
  oppId: string
): Promise<{ success?: boolean; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const canEdit = await client.rpc('can_access_opportunity', {
    p_opp_id: oppId,
    p_level: 'edit',
  });
  if (canEdit.error || canEdit.data !== true) {
    return { error: 'Permission denied to edit products on this opportunity' };
  }

  const { error } = await client
    .from('crm_opportunity_line_items')
    .delete()
    .eq('id', lineItemId)
    .eq('opportunity_id', oppId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function setOpportunitySyncMode(
  oppId: string,
  mode: 'manual' | 'synced'
): Promise<{ data?: any; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const res = await client.rpc('set_opportunity_price_sync_mode', {
    p_opp_id: oppId,
    p_mode: mode,
  });

  if (res.error) {
    return { error: res.error.message };
  }

  return { data: res.data };
}
