'use client';

import React, { useState } from 'react';
import { X, RotateCcw, Check, DollarSign, Calendar } from 'lucide-react';
import {
  ACCOUNT_TYPES,
  ACCOUNT_INDUSTRIES,
  ACCOUNT_SOURCES,
  ACCOUNT_OWNERSHIP,
  type AccountFilterState,
} from '@/types/accounts';

interface AccountFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AccountFilterState;
  onApplyFilters: (filters: AccountFilterState) => void;
  onResetFilters: () => void;
}

export function AccountFilterPanel({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}: AccountFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<AccountFilterState>(filters);

  if (!isOpen) return null;

  const toggleType = (typeVal: string) => {
    const next = localFilters.accountTypes.includes(typeVal)
      ? localFilters.accountTypes.filter((t) => t !== typeVal)
      : [...localFilters.accountTypes, typeVal];
    setLocalFilters({ ...localFilters, accountTypes: next });
  };

  const toggleIndustry = (indVal: string) => {
    const next = localFilters.industries.includes(indVal)
      ? localFilters.industries.filter((i) => i !== indVal)
      : [...localFilters.industries, indVal];
    setLocalFilters({ ...localFilters, industries: next });
  };

  const toggleSource = (srcVal: string) => {
    const next = localFilters.accountSources.includes(srcVal)
      ? localFilters.accountSources.filter((s) => s !== srcVal)
      : [...localFilters.accountSources, srcVal];
    setLocalFilters({ ...localFilters, accountSources: next });
  };

  const toggleOwnership = (ownVal: string) => {
    const next = localFilters.ownership.includes(ownVal)
      ? localFilters.ownership.filter((o) => o !== ownVal)
      : [...localFilters.ownership, ownVal];
    setLocalFilters({ ...localFilters, ownership: next });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Account Filters</h2>
          <p className="text-xs text-slate-500">Refine company and client profile views</p>
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
        {/* Account Types */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Account Type</h3>
          <div className="grid grid-cols-1 gap-1.5">
            {ACCOUNT_TYPES.map((type) => {
              const isChecked = localFilters.accountTypes.includes(type.value);
              return (
                <label
                  key={type.value}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-[#eef2ff] border-indigo-100 text-[#4361ee] font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleType(type.value)}
                    className="rounded text-[#4361ee] focus:ring-[#4361ee] h-3.5 w-3.5"
                  />
                  <span>{type.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Industry */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Industry</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {ACCOUNT_INDUSTRIES.map((ind) => {
              const isChecked = localFilters.industries.includes(ind.value);
              return (
                <label
                  key={ind.value}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-[#eef2ff] border-indigo-100 text-[#4361ee] font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleIndustry(ind.value)}
                    className="rounded text-[#4361ee] focus:ring-[#4361ee] h-3.5 w-3.5"
                  />
                  <span className="truncate">{ind.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Account Source */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Source</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {ACCOUNT_SOURCES.map((src) => {
              const isChecked = localFilters.accountSources.includes(src.value);
              return (
                <label
                  key={src.value}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-[#eef2ff] border-indigo-100 text-[#4361ee] font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSource(src.value)}
                    className="rounded text-[#4361ee] focus:ring-[#4361ee] h-3.5 w-3.5"
                  />
                  <span className="truncate">{src.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Ownership */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Ownership</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {ACCOUNT_OWNERSHIP.map((own) => {
              const isChecked = localFilters.ownership.includes(own.value);
              return (
                <label
                  key={own.value}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-[#eef2ff] border-indigo-100 text-[#4361ee] font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOwnership(own.value)}
                    className="rounded text-[#4361ee] focus:ring-[#4361ee] h-3.5 w-3.5"
                  />
                  <span>{own.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Annual Revenue Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
            Annual Revenue ($)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Min</span>
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
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Max</span>
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
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
          </div>
        </div>

        {/* Created Date Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Created Date Range
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">From</span>
              <input
                type="date"
                value={localFilters.createdDateFrom || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, createdDateFrom: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">To</span>
              <input
                type="date"
                value={localFilters.createdDateTo || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, createdDateTo: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
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
              accountTypes: [],
              industries: [],
              accountSources: [],
              ownership: [],
              ownerId: null,
              minRevenue: null,
              maxRevenue: null,
              createdDateFrom: null,
              createdDateTo: null,
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
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4361ee] hover:bg-[#4361ee] text-white font-medium rounded shadow-xs transition"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
