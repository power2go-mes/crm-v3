'use client';

import React, { useState, useEffect } from 'react';
import type { QuoteRecord, OpportunityLineItemRecord, QuoteLineItemRecord } from '@/types/quotes';
import { saveQuote } from '@/app/(dashboard)/opportunities/[id]/quotes/actions';
import { calculateLineItem, calculateDocumentTotals } from '@/lib/pricing/calculations';
import { X, Plus, Trash2, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

interface EditableQuoteItem {
  id?: string;
  product_id?: string | null;
  product_name: string;
  product_sku?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
}

interface QuoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: {
    id: string;
    name: string;
    account_id?: string | null;
    account?: { id: string; name: string } | null;
    currency?: string;
  };
  initialLineItems?: OpportunityLineItemRecord[];
  quote?: QuoteRecord | null;
  existingItems?: QuoteLineItemRecord[];
  onSuccess: () => void;
}

export function QuoteEditorModal({
  isOpen,
  onClose,
  opportunity,
  initialLineItems = [],
  quote,
  existingItems = [],
  onSuccess,
}: QuoteEditorModalProps) {
  const [subject, setSubject] = useState(
    quote?.subject || `Quotation for ${opportunity.name}`
  );
  const [issueDate, setIssueDate] = useState(
    quote?.issue_date || new Date().toISOString().split('T')[0]
  );
  const [validUntil, setValidUntil] = useState(
    quote?.valid_until ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [currency, setCurrency] = useState(quote?.currency || opportunity.currency || 'INR');
  const [billingAddress, setBillingAddress] = useState(quote?.billing_address || '');
  const [shippingAddress, setShippingAddress] = useState(quote?.shipping_address || '');
  const [terms, setTerms] = useState(
    quote?.terms_and_conditions ||
      '1. Payment due within 30 days of quotation acceptance.\n2. Taxes applicable as per standard regulations.\n3. Goods/services delivered upon agreement.'
  );
  const [customerNotes, setCustomerNotes] = useState(
    quote?.customer_notes || 'Thank you for your business. We look forward to working with you.'
  );

  // Initialize items from quote or opportunity line items
  const [items, setItems] = useState<EditableQuoteItem[]>([]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(
        existingItems.map((it) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          product_sku: it.product_sku,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          discount_percent: Number(it.discount_percent || 0),
          tax_percent: Number(it.tax_percent || 0),
        }))
      );
    } else if (initialLineItems.length > 0) {
      setItems(
        initialLineItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          product_sku: it.product_sku,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          discount_percent: Number(it.discount_percent || 0),
          tax_percent: Number(it.tax_percent || 0),
        }))
      );
    } else {
      setItems([
        {
          product_name: 'Custom Service / Product',
          product_sku: 'GEN-01',
          quantity: 1,
          unit_price: 1000,
          discount_percent: 0,
          tax_percent: 0,
        },
      ]);
    }
  }, [existingItems, initialLineItems]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleItemChange = (index: number, field: keyof EditableQuoteItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        product_name: 'Additional Product / Service',
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_percent: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('A quotation must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Authoritative calculations
  const calculatedItems = items.map((it) => {
    const calc = calculateLineItem(
      Math.max(1, Number(it.quantity) || 1),
      Math.max(0, Number(it.unit_price) || 0),
      Math.min(100, Math.max(0, Number(it.discount_percent) || 0)),
      Math.min(100, Math.max(0, Number(it.tax_percent) || 0))
    );
    return { ...it, ...calc };
  });

  const totals = calculateDocumentTotals(calculatedItems);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Quotation must contain at least one line item.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await saveQuote({
        id: quote?.id,
        opportunity_id: opportunity.id,
        account_id: opportunity.account_id || opportunity.account?.id || null,
        subject,
        issue_date: issueDate,
        valid_until: validUntil,
        currency,
        billing_address: billingAddress || null,
        shipping_address: shippingAddress || null,
        terms_and_conditions: terms || null,
        customer_notes: customerNotes || null,
        items: items.map((it, idx) => ({
          product_id: it.product_id || null,
          product_name: it.product_name,
          product_sku: it.product_sku || null,
          description: it.description || null,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          discount_percent: Number(it.discount_percent) || 0,
          tax_percent: Number(it.tax_percent) || 0,
          sort_order: idx,
        })),
      });

      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative my-8 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 dark:border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {quote ? `Edit Quotation — ${quote.quote_number}` : 'Generate Professional Quotation'}
            </h3>
            <p className="text-xs text-slate-500">
              For deal: <span className="font-semibold text-slate-700 dark:text-slate-300">{opportunity.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-5 text-xs">
          {/* Header Information */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Quotation Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Currency
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-slate-900 focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Valid Until <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Line Items Editor */}
          <div>
            <div className="flex items-center justify-between pb-2">
              <label className="font-bold text-slate-800">
                Quote Line Items ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-800 dark:text-emerald-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {items.map((item, idx) => {
                const cItem = calculatedItems[idx];
                return (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-200 dark:bg-slate-800/40"
                  >
                    <div className="flex-1 min-w-[140px]">
                      <input
                        type="text"
                        placeholder="Product / Item Name"
                        required
                        value={item.product_name}
                        onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 dark:border-slate-700"
                      />
                    </div>

                    <div className="w-20">
                      <input
                        type="number"
                        placeholder="Qty"
                        min="0.01"
                        step="any"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white p-1.5 text-right font-mono text-xs text-slate-900 dark:border-slate-700"
                      />
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        placeholder="Unit Price"
                        min="0"
                        step="0.01"
                        required
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white p-1.5 text-right font-mono text-xs text-slate-900 dark:border-slate-700"
                      />
                    </div>

                    <div className="w-16">
                      <input
                        type="number"
                        placeholder="Disc %"
                        min="0"
                        max="100"
                        value={item.discount_percent}
                        onChange={(e) => handleItemChange(idx, 'discount_percent', e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white p-1.5 text-right font-mono text-xs text-slate-900 dark:border-slate-700"
                      />
                    </div>

                    <div className="w-16">
                      <input
                        type="number"
                        placeholder="Tax %"
                        min="0"
                        max="100"
                        value={item.tax_percent}
                        onChange={(e) => handleItemChange(idx, 'tax_percent', e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white p-1.5 text-right font-mono text-xs text-slate-900 dark:border-slate-700"
                      />
                    </div>

                    <div className="w-28 text-right font-mono font-bold text-slate-900">
                      {currency} {cItem ? cItem.lineTotal.toFixed(2) : '0.00'}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="rounded p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Remove Item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calculations Summary Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-200 dark:bg-slate-800/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 text-slate-600">
                <p>Items Subtotal: <span className="font-mono font-semibold text-slate-900">{currency} {totals.subtotal.toFixed(2)}</span></p>
                <p>Total Discount: <span className="font-mono font-semibold text-red-600 dark:text-red-400">- {currency} {totals.discountTotal.toFixed(2)}</span></p>
                <p>Total Tax: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">+ {currency} {totals.taxTotal.toFixed(2)}</span></p>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Quotation Grand Total
                </span>
                <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {currency} {totals.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Addresses and Terms */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Billing Address
              </label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Client billing address..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Shipping Address
              </label>
              <textarea
                rows={2}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Client shipping address (if applicable)..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Terms &amp; Conditions
            </label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-600 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              <span>{isSubmitting ? 'Saving...' : quote ? 'Update Quotation' : 'Save & Snapshot Quotation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
