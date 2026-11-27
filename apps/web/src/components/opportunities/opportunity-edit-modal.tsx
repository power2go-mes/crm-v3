'use client';

import React, { useState } from 'react';
import { X, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  APPROVED_OPPORTUNITY_STAGES,
  CLOSED_LOST_REASONS,
  type OpportunityWithRelations,
  type OpportunityUpdate,
} from '@/types/opportunities';
import { useAccounts } from '@/hooks/use-accounts';

interface OpportunityEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: OpportunityWithRelations;
  onSubmit: (updates: OpportunityUpdate) => Promise<void>;
}

export function OpportunityEditModal({
  isOpen,
  onClose,
  opportunity,
  onSubmit,
}: OpportunityEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: accountsData } = useAccounts({ pageSize: 100 });
  const accounts = accountsData?.accounts || [];

  const [formData, setFormData] = useState<any>({
    name: opportunity.name || '',
    account_id: opportunity.account_id || '',
    stage: opportunity.stage || 'prospecting',
    amount: opportunity.amount ?? undefined,
    close_date: opportunity.close_date || '',
    probability: opportunity.probability ?? 10,
    next_step: opportunity.next_step || '',
    next_activity_date: opportunity.next_activity_date ? opportunity.next_activity_date.slice(0, 10) : '',
    lost_reason: opportunity.lost_reason || '',
    competitor_name: opportunity.competitor_name || '',
    lost_reason_details: opportunity.lost_reason_details || '',
  });

  if (!isOpen) return null;

  const handleStageChange = (newStageId: string) => {
    const stageCfg = APPROVED_OPPORTUNITY_STAGES.find((s) => s.id === newStageId);
    setFormData((prev: any) => ({
      ...prev,
      stage: newStageId,
      probability: stageCfg ? stageCfg.probability : prev.probability,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setErrorMsg('Opportunity Name is required.');
      return;
    }
    if (!formData.account_id) {
      setErrorMsg('Please select an Account.');
      return;
    }
    if (formData.stage === 'closed_lost' && !formData.lost_reason) {
      setErrorMsg('A valid Closed Lost reason is mandatory when stage is Closed Lost.');
      return;
    }
    if (formData.stage === 'closed_lost' && formData.lost_reason === 'competitor' && !formData.competitor_name?.trim()) {
      setErrorMsg('Competitor name is required when lost to competitor.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        next_step: formData.next_step?.trim() || null,
        next_activity_date: formData.next_activity_date || null,
        lost_reason: formData.stage === 'closed_lost' ? formData.lost_reason : null,
        competitor_name: formData.stage === 'closed_lost' ? formData.competitor_name?.trim() || null : null,
        lost_reason_details: formData.stage === 'closed_lost' ? formData.lost_reason_details?.trim() || null : null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update opportunity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#4361ee]/10 text-[#4361ee] rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Opportunity</h3>
              <p className="text-xs text-slate-400">{opportunity.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Opportunity Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee] text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Account <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.account_id || ''}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              >
                <option value="">Select an Account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Deal Amount ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.amount ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Close Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.close_date || ''}
                  onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={formData.stage || 'prospecting'}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                >
                  {APPROVED_OPPORTUNITY_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.probability}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Probability (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability ?? 10}
                  onChange={(e) =>
                    setFormData({ ...formData, probability: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Next Step
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule architecture review"
                  value={formData.next_step || ''}
                  onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Next Activity / Follow-up Date
                </label>
                <input
                  type="date"
                  value={formData.next_activity_date || ''}
                  onChange={(e) => setFormData({ ...formData, next_activity_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>
            </div>

            {formData.stage === 'closed_lost' && (
              <div className="p-4 bg-red-950/30 border border-orange-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Closed Lost Information (Mandatory)</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Primary Loss Reason <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.lost_reason || ''}
                    onChange={(e) => setFormData({ ...formData, lost_reason: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="">Select loss reason...</option>
                    {CLOSED_LOST_REASONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.lost_reason === 'competitor' && (
                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Winning Competitor <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Corp"
                      value={formData.competitor_name || ''}
                      onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Loss Details & Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Context on why this deal was lost..."
                    value={formData.lost_reason_details || ''}
                    onChange={(e) => setFormData({ ...formData, lost_reason_details: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#4361ee] hover:bg-[#4361ee] text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Update Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
