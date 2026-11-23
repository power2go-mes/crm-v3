'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Product name is required').max(200),
  sku: z.string().trim().min(1, 'SKU / Product Code is required').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().min(1).default('General'),
  type: z.enum(['product', 'service', 'subscription']).default('product'),
  unit_of_measure: z.string().trim().min(1).default('Unit'),
  default_price: z.coerce.number().min(0, 'Default price must be 0 or greater'),
  currency: z.string().trim().min(3).max(3).default('INR'),
  tax_category: z.string().trim().optional().nullable(),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
});

export async function saveProduct(raw: unknown): Promise<{ id?: string; error?: string }> {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid product input' };
  }

  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const { id, ...fields } = parsed.data;
  const action = id ? 'products.update' : 'products.create';

  const perm = await client.rpc('has_effective_permission', {
    p_user_id: user.id,
    p_permission_id: action,
  });
  if (perm.error || perm.data !== true) {
    return { error: 'Permission denied to manage products' };
  }

  // Check duplicate SKU
  let skuQuery = client
    .from('crm_products')
    .select('id')
    .ilike('sku', fields.sku);
  if (id) {
    skuQuery = skuQuery.neq('id', id);
  }
  const existing = await skuQuery.maybeSingle();
  if (existing.data) {
    return { error: `Product SKU "${fields.sku}" already exists. SKU must be unique.` };
  }

  if (id) {
    const { error } = await client
      .from('crm_products')
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return { error: error.message };
    return { id };
  } else {
    const { data, error } = await client
      .from('crm_products')
      .insert({
        ...fields,
        created_by_id: user.id,
      })
      .select('id')
      .single();

    if (error) return { error: error.message };

    // Automatically add product to Standard Price Book
    const stdBook = await client
      .from('crm_price_books')
      .select('id')
      .eq('is_standard', true)
      .maybeSingle();

    if (stdBook.data) {
      await client
        .from('crm_price_book_entries')
        .insert({
          price_book_id: stdBook.data.id,
          product_id: data.id,
          unit_price: fields.default_price,
          currency: fields.currency,
          is_active: fields.is_active,
        })
        .select('id');
    }

    return { id: data.id };
  }
}

export async function deleteProduct(id: string): Promise<{ success?: boolean; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const perm = await client.rpc('has_effective_permission', {
    p_user_id: user.id,
    p_permission_id: 'products.delete',
  });
  if (perm.error || perm.data !== true) {
    return { error: 'Permission denied to delete products' };
  }

  // Check if product has existing line items in opportunities
  const lineItems = await client
    .from('crm_opportunity_line_items')
    .select('id')
    .eq('product_id', id)
    .limit(1);

  if (lineItems.data && lineItems.data.length > 0) {
    return {
      error: 'Cannot delete product because it has been used in sales opportunities. You can deactivate it instead.',
    };
  }

  // Check if product has existing quote items
  const quoteItems = await client
    .from('crm_quote_line_items')
    .select('id')
    .eq('product_id', id)
    .limit(1);

  if (quoteItems.data && quoteItems.data.length > 0) {
    return {
      error: 'Cannot delete product because it exists in historical quotations. Deactivate it instead.',
    };
  }

  // Remove price book entries first
  await client.from('crm_price_book_entries').delete().eq('product_id', id);

  const { error } = await client.from('crm_products').delete().eq('id', id);
  if (error) return { error: error.message };

  return { success: true };
}

export async function toggleProductActive(id: string, is_active: boolean): Promise<{ success?: boolean; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const perm = await client.rpc('has_effective_permission', {
    p_user_id: user.id,
    p_permission_id: 'products.update',
  });
  if (perm.error || perm.data !== true) {
    return { error: 'Permission denied' };
  }

  const { error } = await client
    .from('crm_products')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

const priceBookSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Price book name is required').max(150),
  description: z.string().trim().max(500).optional().nullable(),
  is_standard: z.boolean().default(false),
  is_active: z.boolean().default(true),
  currency: z.string().trim().min(3).max(3).default('INR'),
  effective_from: z.string().optional().nullable(),
  effective_to: z.string().optional().nullable(),
});

export async function savePriceBook(raw: unknown): Promise<{ id?: string; error?: string }> {
  const parsed = priceBookSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid price book input' };
  }

  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const perm = await client.rpc('has_effective_permission', {
    p_user_id: user.id,
    p_permission_id: 'price_books.manage',
  });
  if (perm.error || perm.data !== true) {
    return { error: 'Permission denied to manage price books' };
  }

  const { id, ...fields } = parsed.data;

  if (fields.effective_from && fields.effective_to && fields.effective_from > fields.effective_to) {
    return { error: 'Effective From date cannot be after Effective To date' };
  }

  if (id) {
    const { error } = await client
      .from('crm_price_books')
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return { error: error.message };
    return { id };
  } else {
    const { data, error } = await client
      .from('crm_price_books')
      .insert({
        ...fields,
        created_by_id: user.id,
      })
      .select('id')
      .single();

    if (error) return { error: error.message };
    return { id: data.id };
  }
}

const priceBookEntrySchema = z.object({
  id: z.string().uuid().optional(),
  price_book_id: z.string().uuid(),
  product_id: z.string().uuid(),
  unit_price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  currency: z.string().trim().min(3).max(3).default('INR'),
  is_active: z.boolean().default(true),
});

export async function savePriceBookEntry(raw: unknown): Promise<{ id?: string; error?: string }> {
  const parsed = priceBookEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid entry input' };
  }

  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const perm = await client.rpc('has_effective_permission', {
    p_user_id: user.id,
    p_permission_id: 'price_books.manage',
  });
  if (perm.error || perm.data !== true) {
    return { error: 'Permission denied to manage price book entries' };
  }

  const { id, ...fields } = parsed.data;

  if (id) {
    const { error } = await client
      .from('crm_price_book_entries')
      .update({
        unit_price: fields.unit_price,
        is_active: fields.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return { error: error.message };
    return { id };
  } else {
    const { data, error } = await client
      .from('crm_price_book_entries')
      .upsert({
        ...fields,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'price_book_id, product_id, currency' })
      .select('id')
      .single();

    if (error) return { error: error.message };
    return { id: data.id };
  }
}

export async function deletePriceBookEntry(id: string): Promise<{ success?: boolean; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const perm = await client.rpc('has_effective_permission', {
    p_user_id: user.id,
    p_permission_id: 'price_books.manage',
  });
  if (perm.error || perm.data !== true) {
    return { error: 'Permission denied' };
  }

  const { error } = await client.from('crm_price_book_entries').delete().eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deletePriceBook(id: string): Promise<{ success?: boolean; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const perm = await client.rpc('has_effective_permission', {
    p_user_id: user.id,
    p_permission_id: 'price_books.delete',
  });
  if (perm.error || perm.data !== true) {
    return { error: 'Permission denied to delete price book' };
  }

  // Check if standard price book
  const pb = await client.from('crm_price_books').select('is_standard').eq('id', id).single();
  if (pb.data?.is_standard) {
    return { error: 'The Standard Price Book cannot be deleted.' };
  }

  const { error } = await client.from('crm_price_books').delete().eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}

