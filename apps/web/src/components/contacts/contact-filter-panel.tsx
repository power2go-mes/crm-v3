'use client';

import React, { useState } from 'react';
import { X, RotateCcw, Check, Calendar } from 'lucide-react';
import {
  CONTACT_SOURCES,
  type ContactFilterState,
} from '@/types/contacts';

interface ContactFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ContactFilterState;
  onApplyFilters: (filters: ContactFilterState) => void;
  onResetFilters: () => void;
}

export function ContactFilterPanel({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}: ContactFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<ContactFilterState>(filters);

  if (!isOpen) return null;

  const toggleSource = (srcVal: string) => {
    const next = localFilters.sources.includes(srcVal)
      ? localFilters.sources.filter((s) => s !== srcVal)
      : [...localFilters.sources, srcVal];
    setLocalFilters({ ...localFilters, sources: next });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Contact Filters</h2>
          <p className="text-xs text-slate-500">Refine stakeholder and decision-maker views</p>
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
        {/* Primary Contact Toggle */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Role Type</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'all', label: 'All', value: null },
              { id: 'primary', label: 'Primary Only', value: true },
              { id: 'secondary', label: 'Secondary', value: false },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, isPrimary: opt.value })}
                className={`py-1.5 px-2 rounded text-xs border text-center transition ${
                  localFilters.isPrimary === opt.value
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact Sources */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Lead Source</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {CONTACT_SOURCES.map((src) => {
              const isChecked = localFilters.sources.includes(src.value);
              return (
                <label
                  key={src.value}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer transition ${
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
                  <span className="truncate">{src.label}</span>
                </label>
              );
            })}
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
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              sources: [],
              isPrimary: null,
              ownerId: null,
              accountId: null,
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
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-xs transition"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
