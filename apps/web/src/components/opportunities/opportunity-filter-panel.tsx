'use client';

import React, { useState } from 'react';
import { X, RotateCcw, Check, DollarSign, Calendar } from 'lucide-react';
import {
  APPROVED_OPPORTUNITY_STAGES,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_LEAD_SOURCES,
  type OpportunityFilterState,
} from '@/types/opportunities';

interface OpportunityFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: OpportunityFilterState;
  onApplyFilters: (filters: OpportunityFilterState) => void;
  onResetFilters: () => void;
}

export function OpportunityFilterPanel({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
}: OpportunityFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<OpportunityFilterState>(filters);

  if (!isOpen) return null;

  const toggleStage = (stageName: string) => {
    const next = localFilters.stages.includes(stageName)
      ? localFilters.stages.filter((s) => s !== stageName)
      : [...localFilters.stages, stageName];
    setLocalFilters({ ...localFilters, stages: next });
  };

  const toggleType = (typeId: string) => {
    const next = localFilters.opportunityTypes.includes(typeId)
      ? localFilters.opportunityTypes.filter((t) => t !== typeId)
      : [...localFilters.opportunityTypes, typeId];
    setLocalFilters({ ...localFilters, opportunityTypes: next });
  };

  const toggleSource = (sourceId: string) => {
    const next = localFilters.leadSources.includes(sourceId)
      ? localFilters.leadSources.filter((s) => s !== sourceId)
      : [...localFilters.leadSources, sourceId];
    setLocalFilters({ ...localFilters, leadSources: next });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Opportunity Filters</h2>
          <p className="text-xs text-slate-500">Refine pipeline deals and revenue views</p>
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
        {/* Pipeline Stages */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">
            Pipeline Stage ({APPROVED_OPPORTUNITY_STAGES.length})
          </h3>
          <div className="grid grid-cols-1 gap-1.5">
            {APPROVED_OPPORTUNITY_STAGES.map((stg) => {
              const isChecked = localFilters.stages.includes(stg.name) || localFilters.stages.includes(stg.id);
              return (
                <label
                  key={stg.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-[#eef2ff] border-indigo-100 text-[#4361ee] font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleStage(stg.name)}
                      className="rounded text-[#4361ee] focus:ring-[#4361ee] h-3.5 w-3.5"
                    />
                    <span>{stg.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">{stg.probability}%</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Opportunity Types */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Deal Type</h3>
          <div className="grid grid-cols-1 gap-1.5">
            {OPPORTUNITY_TYPES.map((type) => {
              const isChecked = localFilters.opportunityTypes.includes(type.id);
              return (
                <label
                  key={type.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-[#eef2ff] border-indigo-100 text-[#4361ee] font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleType(type.id)}
                    className="rounded text-[#4361ee] focus:ring-[#4361ee] h-3.5 w-3.5"
                  />
                  <span>{type.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Lead Sources */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2">Lead Source</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {OPPORTUNITY_LEAD_SOURCES.map((src) => {
              const isChecked = localFilters.leadSources.includes(src.id);
              return (
                <label
                  key={src.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-[#eef2ff] border-indigo-100 text-[#4361ee] font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSource(src.id)}
                    className="rounded text-[#4361ee] focus:ring-[#4361ee] h-3.5 w-3.5"
                  />
                  <span className="truncate">{src.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Close Date Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Expected Close Date
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">From</span>
              <input
                type="date"
                value={localFilters.closeDateFrom || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, closeDateFrom: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">To</span>
              <input
                type="date"
                value={localFilters.closeDateTo || ''}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, closeDateTo: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
          </div>
        </div>

        {/* Amount Range */}
        <div>
          <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
            Deal Amount Range
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Min ($)</span>
              <input
                type="number"
                placeholder="0"
                value={localFilters.minAmount ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    minAmount: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Max ($)</span>
              <input
                type="number"
                placeholder="1,000,000"
                value={localFilters.maxAmount ?? ''}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    maxAmount: e.target.value ? Number(e.target.value) : null,
                  })
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
              stages: [],
              opportunityTypes: [],
              leadSources: [],
              ownerId: null,
              closeDateFrom: null,
              closeDateTo: null,
              minAmount: null,
              maxAmount: null,
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
