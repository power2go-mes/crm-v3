'use client';

import React, { useState } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import {
  LEAD_SOURCES,
  INDUSTRY_CHOICES,
  CANONICAL_LEAD_STAGES,
  type LeadFilterState,
} from '@/types/leads';

interface LeadFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: LeadFilterState;
  onApplyFilters: (filters: LeadFilterState) => void;
  onResetFilters: () => void;
}

export function LeadFilterPanel({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}: LeadFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<LeadFilterState>(filters);

  if (!isOpen) return null;

  const toggleStatus = (id: string) => {
    const next = localFilters.status.includes(id)
      ? localFilters.status.filter((s) => s !== id)
      : [...localFilters.status, id];
    setLocalFilters({ ...localFilters, status: next });
  };

  const toggleSource = (val: string) => {
    const next = localFilters.source.includes(val)
      ? localFilters.source.filter((s) => s !== val)
      : [...localFilters.source, val];
    setLocalFilters({ ...localFilters, source: next });
  };

  const toggleIndustry = (val: string) => {
    const next = localFilters.industry.includes(val)
      ? localFilters.industry.filter((i) => i !== val)
      : [...localFilters.industry, val];
    setLocalFilters({ ...localFilters, industry: next });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Filters</h2>
          <p className="text-xs text-slate-500">Refine lead records view</p>
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
        {/* Status Stages */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Lead Status</h3>
          <div className="grid grid-cols-2 gap-2">
            {CANONICAL_LEAD_STAGES.map((stage) => {
              const isChecked = localFilters.status.includes(stage.id);
              return (
                <label
                  key={stage.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleStatus(stage.id)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>{stage.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Lead Source */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Lead Source</h3>
          <div className="grid grid-cols-2 gap-2">
            {LEAD_SOURCES.map((src) => {
              const isChecked = localFilters.source.includes(src.value);
              return (
                <label
                  key={src.value}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSource(src.value)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>{src.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Industry */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Industry</h3>
          <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
            {INDUSTRY_CHOICES.map((ind) => {
              const isChecked = localFilters.industry.includes(ind.value);
              return (
                <label
                  key={ind.value}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleIndustry(ind.value)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>{ind.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Annual Revenue Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Annual Revenue ($)</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500">Min:</label>
              <input
                type="number"
                placeholder="0"
                value={localFilters.minRevenue ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    minRevenue: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Max:</label>
              <input
                type="number"
                placeholder="10,000,000"
                value={localFilters.maxRevenue ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    maxRevenue: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Created Date</h3>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-slate-500">From:</label>
              <input
                type="date"
                value={localFilters.dateFrom || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, dateFrom: e.target.value || null })
                }
                className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">To:</label>
              <input
                type="date"
                value={localFilters.dateTo || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, dateTo: e.target.value || null })
                }
                className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
        <button
          type="button"
          onClick={() => {
            onResetFilters();
            setLocalFilters({
              search: '',
              status: [],
              source: [],
              industry: [],
              ownerId: null,
              subOwnerId: null,
              dateFrom: null,
              dateTo: null,
              minRevenue: null,
              maxRevenue: null,
            });
            onClose();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded hover:bg-white transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onApplyFilters(localFilters);
            onClose();
          }}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-xs"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Apply Filters</span>
        </button>
      </div>
    </div>
  );
}
