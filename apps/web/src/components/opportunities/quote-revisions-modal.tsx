'use client';

import React from 'react';
import { useQuoteRevisions } from '@/hooks/use-quotes';
import type { QuoteRecord } from '@/types/quotes';
import { X, History, CheckCircle2, AlertCircle } from 'lucide-react';

interface QuoteRevisionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: QuoteRecord;
}

export function QuoteRevisionsModal({ isOpen, onClose, quote }: QuoteRevisionsModalProps) {
  const { data: revisions = [], isLoading } = useQuoteRevisions(quote.id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Revision History — {quote.quote_number}
              </h3>
              <p className="text-xs text-slate-500">
                Immutable snapshot ledger tracking every state and value transition.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 max-h-96 overflow-y-auto space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Loading revision timeline...
            </div>
          ) : revisions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No historical revisions archived for this quote yet.
            </div>
          ) : (
            revisions.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      Rev #{rev.revision_number}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {rev.snapshot_data?.quote?.status || 'Archived'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(rev.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-2 text-xs dark:border-slate-700/60 sm:grid-cols-4">
                  <div>
                    <span className="text-slate-400">Subtotal:</span>
                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {quote.currency} {Number(rev.snapshot_data?.quote?.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Discount:</span>
                    <p className="font-mono font-medium text-red-600 dark:text-red-400">
                      - {quote.currency} {Number(rev.snapshot_data?.quote?.discount_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Tax:</span>
                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      + {quote.currency} {Number(rev.snapshot_data?.quote?.tax_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Grand Total:</span>
                    <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {quote.currency} {Number(rev.snapshot_data?.quote?.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {rev.snapshot_data?.items && Array.isArray(rev.snapshot_data.items) && (
                  <div className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500 dark:border-slate-700/60">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Items in snapshot ({rev.snapshot_data.items.length}):
                    </span>{' '}
                    {rev.snapshot_data.items.map((it: any) => `${it.product_name} (×${it.quantity})`).join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
