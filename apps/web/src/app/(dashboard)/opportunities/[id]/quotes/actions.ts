'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calculateLineItem, calculateDocumentTotals } from '@/lib/pricing/calculations';
import type { QuoteStatus } from '@/types/quotes';

const quoteLineItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional().nullable(),
  product_name: z.string().trim().min(1, 'Product name is required'),
  product_sku: z.string().trim().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  tax_percent: z.coerce.number().min(0).max(100).default(0),
  sort_order: z.coerce.number().int().default(0),
});

const quoteInputSchema = z.object({
  id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid(),
  account_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  status: z.enum(['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired']).default('Draft'),
  issue_date: z.string().min(1, 'Issue date is required'),
  valid_until: z.string().min(1, 'Valid until date is required'),
  currency: z.string().trim().min(3).max(3).default('INR'),
  billing_address: z.string().trim().max(1000).optional().nullable(),
  shipping_address: z.string().trim().max(1000).optional().nullable(),
  terms_and_conditions: z.string().trim().max(5000).optional().nullable(),
  customer_notes: z.string().trim().max(2000).optional().nullable(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(quoteLineItemInputSchema).min(1, 'Quote must have at least one line item'),
});

export async function saveQuote(raw: unknown): Promise<{ id?: string; quote_number?: string; error?: string }> {
  const parsed = quoteInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid quote input' };
  }

  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const { id, items, ...header } = parsed.data;

  // Validate Opportunity edit permissions
  const canEdit = await client.rpc('can_access_opportunity', {
    p_opp_id: header.opportunity_id,
    p_level: 'edit',
  });
  if (canEdit.error || canEdit.data !== true) {
    return { error: 'Permission denied for this opportunity' };
  }

  // Calculate authoritative line items and document totals
  const calculatedItems = items.map((item, idx) => {
    const calc = calculateLineItem(
      item.quantity,
      item.unit_price,
      item.discount_percent,
      item.tax_percent
    );
    return {
      product_id: item.product_id || null,
      product_name: item.product_name,
      product_sku: item.product_sku || null,
      description: item.description || null,
      quantity: calc.quantity,
      unit_price: calc.unitPrice,
      discount_percent: calc.discountPercent,
      discount_amount: calc.discountAmount,
      tax_percent: calc.taxPercent,
      tax_amount: calc.taxAmount,
      line_total: calc.lineTotal,
      sort_order: item.sort_order ?? idx,
    };
  });

  const totals = calculateDocumentTotals(calculatedItems);

  let quoteId = id;
  let quoteNumber: string | undefined;

  if (quoteId) {
    // If quote already exists, check status
    const existing = await client
      .from('crm_quotes')
      .select('status, quote_number')
      .eq('id', quoteId)
      .single();

    if (existing.error || !existing.data) return { error: 'Quote not found' };
    quoteNumber = existing.data.quote_number;

    const { error: updateError } = await client
      .from('crm_quotes')
      .update({
        ...header,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (updateError) return { error: updateError.message };

    // Replace line items
    await client.from('crm_quote_line_items').delete().eq('quote_id', quoteId);
  } else {
    const { data: newQuote, error: insertError } = await client
      .from('crm_quotes')
      .insert({
        ...header,
        owner_id: user.id,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
      })
      .select('id, quote_number')
      .single();

    if (insertError) return { error: insertError.message };
    quoteId = newQuote.id;
    quoteNumber = newQuote.quote_number;
  }

  // Insert line items
  const itemsToInsert = calculatedItems.map(item => ({
    ...item,
    quote_id: quoteId,
  }));

  const { error: itemsError } = await client
    .from('crm_quote_line_items')
    .insert(itemsToInsert);

  if (itemsError) return { error: itemsError.message };

  // Create immutable snapshot revision
  await client.rpc('save_quote_revision_snapshot', {
    p_quote_id: quoteId,
  });

  return { id: quoteId, quote_number: quoteNumber };
}

export async function updateQuoteStatus(
  quoteId: string,
  newStatus: QuoteStatus
): Promise<{ success?: boolean; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const quoteRes = await client
    .from('crm_quotes')
    .select('id, status, opportunity_id')
    .eq('id', quoteId)
    .single();

  if (quoteRes.error || !quoteRes.data) return { error: 'Quote not found' };

  const canEdit = await client.rpc('can_access_opportunity', {
    p_opp_id: quoteRes.data.opportunity_id,
    p_level: 'edit',
  });
  if (canEdit.error || canEdit.data !== true) {
    return { error: 'Permission denied to update this quote' };
  }

  const currentStatus = quoteRes.data.status as QuoteStatus;

  // Status transitions validation
  const allowedTransitions: Record<QuoteStatus, QuoteStatus[]> = {
    Draft: ['Sent', 'Accepted', 'Rejected'],
    Sent: ['Accepted', 'Rejected', 'Expired'],
    Accepted: [],
    Rejected: ['Draft'],
    Expired: ['Draft'],
  };

  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    return {
      error: `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
    };
  }

  const { error } = await client
    .from('crm_quotes')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) return { error: error.message };

  // Snapshot new status
  await client.rpc('save_quote_revision_snapshot', { p_quote_id: quoteId });

  return { success: true };
}

export async function deleteQuote(quoteId: string): Promise<{ success?: boolean; error?: string }> {
  const client = (await createClient()) as any;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Authentication required' };

  const quoteRes = await client
    .from('crm_quotes')
    .select('id, status, opportunity_id')
    .eq('id', quoteId)
    .single();

  if (quoteRes.error || !quoteRes.data) return { error: 'Quote not found' };

  if (quoteRes.data.status !== 'Draft') {
    return { error: 'Only Draft quotations can be deleted. Accepted, Sent, or historical quotes cannot be deleted.' };
  }

  const canEdit = await client.rpc('can_access_opportunity', {
    p_opp_id: quoteRes.data.opportunity_id,
    p_level: 'edit',
  });
  if (canEdit.error || canEdit.data !== true) {
    return { error: 'Permission denied to delete this quote' };
  }

  const { error } = await client.from('crm_quotes').delete().eq('id', quoteId);
  if (error) return { error: error.message };

  return { success: true };
}
