'use client';

import React, { useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { APPROVED_OPPORTUNITY_STAGES, type OpportunityInsert } from '@/types/opportunities';
import { useAccounts } from '@/hooks/use-accounts';
import { useAuth } from '@/components/providers/auth-provider';

interface OpportunityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (opp: OpportunityInsert) => Promise<void>;
  preselectedAccountId?: string;
}

export function OpportunityCreateModal({
  isOpen,
  onClose,
  onSubmit,
  preselectedAccountId,
}: OpportunityCreateModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: accountsData } = useAccounts({ pageSize: 100 });
  const accounts = accountsData?.accounts || [];

  const defaultStage = APPROVED_OPPORTUNITY_STAGES[0];

  const [formData, setFormData] = useState<any>({
    name: '',
    account_id: preselectedAccountId || '',
    stage: defaultStage.id,
    amount: undefined,
    close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    probability: defaultStage.probability,
    owner_id: user?.id || null,
    next_step: '',
    next_activity_date: '',
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
    if (!formData.name.trim()) {
      setErrorMsg('Opportunity Name is required.');
      return;
    }
    if (!formData.account_id) {
      setErrorMsg('Please select an Account for this opportunity.');
      return;
    }
    if (!formData.close_date) {
      setErrorMsg('Close Date is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        owner_id: user?.id || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create opportunity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create New Opportunity</h3>
              <p className="text-xs text-slate-400">Track deal value, stages, and forecast timelines.</p>
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
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enterprise Cloud Modernization"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Account <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  placeholder="250000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Close Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.close_date}
                  onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  placeholder="e.g. Schedule discovery call"
                  value={formData.next_step || ''}
                  onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
