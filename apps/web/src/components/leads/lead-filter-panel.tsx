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
    <>
      {/* Backdrop to ensure it renders on top and dismisses on click */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white border-l border-slate-100 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-[#f8faff]">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-wide">Filters</h2>
            <p className="text-xs text-slate-400 font-medium">Refine lead records view</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Status Stages */}
          <div>
            <h3 className="font-bold text-slate-800 tracking-wider mb-2.5">Lead Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {CANONICAL_LEAD_STAGES.map((stage) => {
                const isChecked = localFilters.status.includes(stage.id);
                return (
                  <label
                    key={stage.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition font-medium ${
                      isChecked
                        ? 'bg-[#eef2ff] border-indigo-200 text-[#4361ee] font-bold'
                        : 'border-slate-200/80 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleStatus(stage.id)}
                      className="h-3.5 w-3.5 rounded-md text-[#4361ee] border-slate-300 focus:ring-[#4361ee]"
                    />
                    <span className="truncate">{stage.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Sources */}
          <div>
            <h3 className="font-bold text-slate-800 tracking-wider mb-2.5">Lead Source</h3>
            <div className="grid grid-cols-2 gap-2">
              {LEAD_SOURCES.slice(0, 8).map((source) => {
                const isChecked = localFilters.source.includes(source.value);
                return (
                  <label
                    key={source.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition font-medium ${
                      isChecked
                        ? 'bg-[#eef2ff] border-indigo-200 text-[#4361ee] font-bold'
                        : 'border-slate-200/80 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSource(source.value)}
                      className="h-3.5 w-3.5 rounded-md text-[#4361ee] border-slate-300 focus:ring-[#4361ee]"
                    />
                    <span className="truncate">{source.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Revenue Range */}
          <div>
            <h3 className="font-bold text-slate-800 tracking-wider mb-2.5">Annual Revenue</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Min:</label>
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
                  className="w-full mt-1 px-3 py-2 border border-slate-200/80 rounded-xl text-xs bg-[#f8faff] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Max:</label>
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
                  className="w-full mt-1 px-3 py-2 border border-slate-200/80 rounded-xl text-xs bg-[#f8faff] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <h3 className="font-bold text-slate-800 tracking-wider mb-2.5">Created Date</h3>
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">From:</label>
                <input
                  type="date"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, dateFrom: e.target.value || null })
                  }
                  className="w-full mt-1 px-3 py-2 border border-slate-200/80 rounded-xl text-xs bg-[#f8faff] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">To:</label>
                <input
                  type="date"
                  value={localFilters.dateTo || ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, dateTo: e.target.value || null })
                  }
                  className="w-full mt-1 px-3 py-2 border border-slate-200/80 rounded-xl text-xs bg-[#f8faff] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-[#f8faff]">
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition shadow-2xs"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#4361ee] hover:bg-[#3a5bf0] rounded-xl transition shadow-md shadow-indigo-500/20"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>
    </>
  );
}
