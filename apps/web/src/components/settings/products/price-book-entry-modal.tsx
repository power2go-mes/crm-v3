'use client';

import React, { useState } from 'react';
import type { PriceBookRecord, PriceBookEntryRecord, ProductRecord } from '@/types/products';
import { savePriceBookEntry } from '@/app/(dashboard)/settings/products/actions';
import { X, AlertCircle } from 'lucide-react';

interface PriceBookEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceBook: PriceBookRecord;
  entry?: PriceBookEntryRecord | null;
  products: ProductRecord[];
  onSuccess: () => void;
}

export function PriceBookEntryModal({
  isOpen,
  onClose,
  priceBook,
  entry,
  products,
  onSuccess,
}: PriceBookEntryModalProps) {
  const [productId, setProductId] = useState(entry?.product_id || (products[0]?.id || ''));
  const [unitPrice, setUnitPrice] = useState(entry ? String(entry.unit_price) : '0');
  const [isActive, setIsActive] = useState(entry?.is_active ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProductChange = (pId: string) => {
    setProductId(pId);
    const prod = products.find((p) => p.id === pId);
    if (prod && !entry) {
      setUnitPrice(String(prod.default_price));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await savePriceBookEntry({
        id: entry?.id,
        price_book_id: priceBook.id,
        product_id: productId,
        unit_price: Number(unitPrice),
        currency: priceBook.currency,
        is_active: isActive,
      });

      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {entry ? 'Edit Price Entry' : 'Add Product to Price Book'}
            </h2>
            <p className="text-xs text-slate-500">{priceBook.name} ({priceBook.currency})</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Product <span className="text-red-500">*</span>
            </label>
            <select
              disabled={!!entry}
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white disabled:bg-slate-100"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — Base: {p.currency} {p.default_price}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Book Unit Price ({priceBook.currency}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPbeActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-800 focus:ring-emerald-500"
            />
            <label htmlFor="isPbeActiveCheck" className="text-xs font-medium text-slate-700 select-none">
              Active pricing in this book
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-600 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : entry ? 'Update Price' : 'Add to Price Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
