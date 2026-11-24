'use client';

import React, { useState } from 'react';
import { X, RotateCcw, Check, Calendar, DollarSign } from 'lucide-react';
import {
  CAMPAIGN_STATUS_CHOICES,
  CAMPAIGN_TYPE_CHOICES,
  type CampaignFilterState,
} from '@/types/campaigns';

interface CampaignFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: CampaignFilterState;
  onApplyFilters: (filters: CampaignFilterState) => void;
  onResetFilters: () => void;
}

export function CampaignFilterPanel({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}: CampaignFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<CampaignFilterState>(filters);

  if (!isOpen) return null;

  const toggleStatus = (statusId: string) => {
    const next = localFilters.status.includes(statusId)
      ? localFilters.status.filter((s) => s !== statusId)
      : [...localFilters.status, statusId];
    setLocalFilters({ ...localFilters, status: next });
  };

  const toggleType = (typeId: string) => {
    const next = localFilters.campaignType.includes(typeId)
      ? localFilters.campaignType.filter((t) => t !== typeId)
      : [...localFilters.campaignType, typeId];
    setLocalFilters({ ...localFilters, campaignType: next });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Campaign Filters</h2>
          <p className="text-xs text-slate-500">Refine marketing programs and performance</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Filter Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-700">
        {/* Campaign Status */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Status</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {CAMPAIGN_STATUS_CHOICES.map((st) => {
              const isChecked = localFilters.status.includes(st.id);
              return (
                <label
                  key={st.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleStatus(st.id)}
                    className="rounded text-emerald-800 focus:ring-emerald-500 h-3.5 w-3.5"
                  />
                  <span>{st.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Campaign Type */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Type</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {CAMPAIGN_TYPE_CHOICES.map((ct) => {
              const isChecked = localFilters.campaignType.includes(ct.id);
              return (
                <label
                  key={ct.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleType(ct.id)}
                    className="rounded text-emerald-800 focus:ring-emerald-500 h-3.5 w-3.5"
                  />
                  <span>{ct.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Start Date Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Start Date Range
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">From</span>
              <input
                type="date"
                value={localFilters.startDateFrom || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, startDateFrom: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">To</span>
              <input
                type="date"
                value={localFilters.startDateTo || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, startDateTo: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Expected Revenue Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
            Expected Revenue ($)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Min</span>
              <input
                type="number"
                placeholder="0"
                value={localFilters.minExpectedRevenue ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    minExpectedRevenue: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Max</span>
              <input
                type="number"
                placeholder="100,000"
                value={localFilters.maxExpectedRevenue ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    maxExpectedRevenue: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            onResetFilters();
            setLocalFilters({
              status: [],
              campaignType: [],
              startDateFrom: null,
              startDateTo: null,
              endDateFrom: null,
              endDateTo: null,
              minExpectedRevenue: null,
              maxExpectedRevenue: null,
              minBudgetCost: null,
              maxBudgetCost: null,
            });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded border border-slate-300 hover:bg-slate-100 transition"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApplyFilters(localFilters);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white font-medium rounded shadow-xs transition"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
