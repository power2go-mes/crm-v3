'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { CLOSED_LOST_REASONS } from '@/types/opportunities';

interface ClosedLostModalProps {
  isOpen: boolean;
  opportunityName: string;
  onClose: () => void;
  onConfirm: (data: {
    lost_reason: string;
    competitor_name?: string;
    lost_reason_details?: string;
  }) => Promise<void>;
}

export function ClosedLostModal({
  isOpen,
  opportunityName,
  onClose,
  onConfirm,
}: ClosedLostModalProps) {
  const [reason, setReason] = useState<string>('');
  const [competitor, setCompetitor] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError('A Closed Lost reason is required to close this opportunity.');
      return;
    }

    if (reason === 'competitor' && !competitor.trim()) {
      setError('Please specify the competitor name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm({
        lost_reason: reason,
        competitor_name: competitor.trim() || undefined,
        lost_reason_details: details.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update opportunity to Closed Lost.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-200 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl dark:bg-red-900/40 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Close Opportunity as Lost
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">{opportunityName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-2 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Primary Loss Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800"
              required
            >
              <option value="">Select loss reason...</option>
              {CLOSED_LOST_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {reason === 'competitor' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Winning Competitor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={competitor}
                onChange={(e) => setCompetitor(e.target.value)}
                placeholder="e.g. Acme Corp, Salesforce, HubSpot"
                className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Loss Analysis & Notes
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide strategic context on why the deal was lost, key factors, or future re-engagement potential..."
              className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason}
              className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? 'Recording Loss...' : 'Confirm Closed Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
