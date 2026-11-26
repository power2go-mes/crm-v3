'use client';

import React from 'react';
import type { ProductRecord } from '@/types/products';
import { useProductUsage } from '@/hooks/use-products';
import { X, Layers, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ProductUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductRecord | null;
}

export function ProductUsageModal({ isOpen, onClose, product }: ProductUsageModalProps) {
  const { data: usage, isLoading } = useProductUsage(product?.id);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Product Usage History</h2>
            <p className="text-xs text-slate-500">{product.name} ({product.sku})</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading transactional history...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-center">
                  <div className="flex justify-center mb-1 text-emerald-800">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">{usage?.lineItemsCount || 0}</div>
                  <div className="text-[11px] text-slate-500">Opportunity Line Items</div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-center">
                  <div className="flex justify-center mb-1 text-emerald-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">{usage?.quotesCount || 0}</div>
                  <div className="text-[11px] text-slate-500">Quotation Line Items</div>
                </div>
              </div>

              {(usage?.lineItemsCount || 0) > 0 || (usage?.quotesCount || 0) > 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">Protected Historical Transactions</span>
                    <p className="mt-0.5 text-amber-700">
                      This product is linked to active opportunities or quotations. To safeguard historical financial audits, it cannot be permanently deleted. You can deactivate it to hide it from new quotes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>No transactional records linked. Safe to edit or delete if needed.</span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
