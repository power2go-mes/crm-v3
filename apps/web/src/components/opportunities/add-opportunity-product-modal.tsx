'use client';

import React, { useState, useEffect } from 'react';
import type { OpportunityLineItemRecord } from '@/types/quotes';
import type { ProductRecord } from '@/types/products';
import { useProducts } from '@/hooks/use-products';
import { usePriceBookEntries } from '@/hooks/use-price-books';
import { saveOpportunityLineItem } from '@/app/(dashboard)/opportunities/[id]/products/actions';
import { calculateLineItem } from '@/lib/pricing/calculations';
import { X, AlertCircle } from 'lucide-react';

interface AddOpportunityProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  priceBookId?: string | null;
  currency?: string;
  item?: OpportunityLineItemRecord | null;
  onSuccess: () => void;
}

export function AddOpportunityProductModal({
  isOpen,
  onClose,
  opportunityId,
  priceBookId,
  currency = 'INR',
  item,
  onSuccess,
}: AddOpportunityProductModalProps) {
  const { data: productsData } = useProducts({ pageSize: 100, status: 'active' });
  const allProducts = productsData?.products || [];
  const { data: pbEntries = [] } = usePriceBookEntries(priceBookId || undefined);

  const [productId, setProductId] = useState(item?.product_id || '');
  const [productName, setProductName] = useState(item?.product_name || '');
  const [productSku, setProductSku] = useState(item?.product_sku || '');
  const [description, setDescription] = useState(item?.description || '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '1');
  const [unitPrice, setUnitPrice] = useState(item ? String(item.unit_price) : '0');
  const [discountPercent, setDiscountPercent] = useState(item ? String(item.discount_percent) : '0');
  const [taxPercent, setTaxPercent] = useState(item ? String(item.tax_percent) : '0');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set initial product if not editing
  useEffect(() => {
    if (!item && allProducts.length > 0 && !productId) {
      handleProductSelect(allProducts[0].id);
    }
  }, [allProducts, item]);

  if (!isOpen) return null;

  const handleProductSelect = (pId: string) => {
    setProductId(pId);
    const prod = allProducts.find((p: ProductRecord) => p.id === pId);
    if (!prod) return;

    setProductName(prod.name);
    setProductSku(prod.sku);
    setTaxPercent(String(prod.tax_rate || 0));

    // Check if price book has special entry
    const entry = pbEntries.find((e) => e.product_id === pId && e.is_active);
    if (entry) {
      setUnitPrice(String(entry.unit_price));
    } else {
      setUnitPrice(String(prod.default_price));
    }
  };

  const qtyNum = Math.max(1, Number(quantity) || 1);
  const priceNum = Math.max(0, Number(unitPrice) || 0);
  const discNum = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const taxNum = Math.min(100, Math.max(0, Number(taxPercent) || 0));

  const preview = calculateLineItem(qtyNum, priceNum, discNum, taxNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Please select a product');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await saveOpportunityLineItem(opportunityId, {
        id: item?.id,
        opportunity_id: opportunityId,
        product_id: productId,
        product_name: productName,
        product_sku: productSku,
        description: description || null,
        quantity: qtyNum,
        unit_price: priceNum,
        discount_percent: discNum,
        tax_percent: taxNum,
      });

      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product line item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 dark:border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {item ? 'Edit Opportunity Product' : 'Add Product to Opportunity'}
            </h3>
            <p className="text-xs text-slate-500">
              Configure product quantity, pricing, discounts, and applicable taxes.
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Product selector */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Select Product <span className="text-red-500">*</span>
            </label>
            <select
              value={productId}
              onChange={(e) => handleProductSelect(e.target.value)}
              disabled={!!item}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              {allProducts.map((p: ProductRecord) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — {currency} {p.default_price}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Sales Unit Price ({currency}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Discount (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Line Item Notes / Customization
            </label>
            <input
              type="text"
              placeholder="e.g. Annual renewal discount applied"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {/* Real-time Calculation Summary Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-200 dark:bg-slate-800/40">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Line Calculation Preview
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="text-slate-600">
                Subtotal ({qtyNum} × {currency} {priceNum.toFixed(2)}):
              </div>
              <div className="text-right font-mono font-medium text-slate-900">
                {currency} {preview.subtotal.toFixed(2)}
              </div>

              {preview.discountAmount > 0 && (
                <>
                  <div className="text-slate-600">
                    Discount ({preview.discountPercent}%):
                  </div>
                  <div className="text-right font-mono font-medium text-red-600 dark:text-red-400">
                    - {currency} {preview.discountAmount.toFixed(2)}
                  </div>
                </>
              )}

              {preview.taxAmount > 0 && (
                <>
                  <div className="text-slate-600">
                    Tax ({preview.taxPercent}%):
                  </div>
                  <div className="text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                    + {currency} {preview.taxAmount.toFixed(2)}
                  </div>
                </>
              )}

              <div className="border-t border-slate-200 pt-1 font-bold text-slate-900 dark:border-slate-700">
                Line Total:
              </div>
              <div className="border-t border-slate-200 pt-1 text-right font-mono font-bold text-[#4361ee] dark:border-slate-700 dark:text-[#4361ee]">
                {currency} {preview.lineTotal.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#4361ee] disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : item ? 'Update Item' : 'Add to Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
