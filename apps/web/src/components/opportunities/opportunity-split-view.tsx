'use client';

import React, { useState } from 'react';
import type { OpportunityWithRelations } from '@/types/opportunities';
import { OpportunityStageBadge } from './opportunity-stage-badge';
import Link from 'next/link';
import {
  TrendingUp,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  Edit2,
  User,
} from 'lucide-react';

interface OpportunitySplitViewProps {
  opportunities: OpportunityWithRelations[];
  selectedOppId?: string | null;
  onSelectOpp?: (opp: OpportunityWithRelations) => void;
  onEditOpp?: (opp: OpportunityWithRelations) => void;
  isLoading?: boolean;
}

export function OpportunitySplitView({
  opportunities,
  selectedOppId,
  onSelectOpp,
  onEditOpp,
  isLoading = false,
}: OpportunitySplitViewProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedOppId || (opportunities.length > 0 ? opportunities[0].id : null)
  );

  const activeId = selectedOppId ?? internalSelectedId;
  const activeOpp = opportunities.find((o) => o.id === activeId) || opportunities[0];

  const handleSelect = (opp: OpportunityWithRelations) => {
    setInternalSelectedId(opp.id);
    onSelectOpp?.(opp);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[700px] animate-pulse">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6" />
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
        <p className="text-sm text-slate-500">No opportunities found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[750px]">
      {/* Left List Pane */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
          <span>Opportunities ({opportunities.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {opportunities.map((opp) => {
            const isSelected = opp.id === activeOpp?.id;
            return (
              <div
                key={opp.id}
                onClick={() => handleSelect(opp)}
                className={`p-3.5 cursor-pointer transition text-left ${
                  isSelected
                    ? 'bg-emerald-50/70 border-l-4 border-emerald-200'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{opp.name}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {opp.account?.name || 'No Account'}
                    </p>
                  </div>
                  <OpportunityStageBadge stage={opp.stage} />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">
                    ${Number(opp.amount || 0).toLocaleString()}
                  </span>
                  <span>{opp.probability || 0}% prob</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Detail Preview Pane */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 overflow-y-auto shadow-xs flex flex-col justify-between">
        {activeOpp ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{activeOpp.name}</h2>
                  <OpportunityStageBadge stage={activeOpp.stage} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Account: {activeOpp.account?.name || '—'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onEditOpp && (
                  <button
                    type="button"
                    onClick={() => onEditOpp(activeOpp)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Edit Opportunity"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                <Link
                  href={`/opportunities/${activeOpp.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  <span>Full View</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Deal Amount</span>
                <span className="text-base font-bold text-emerald-600 mt-1 block">
                  ${Number(activeOpp.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Probability</span>
                <span className="text-base font-bold text-emerald-800 mt-1 block">
                  {activeOpp.probability || 0}%
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Expected Close</span>
                <span className="text-base font-bold text-slate-800 mt-1 block truncate">
                  {activeOpp.close_date || '—'}
                </span>
              </div>
            </div>

            {/* Field Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pipeline Stage</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block capitalize">
                    {activeOpp.stage?.replace(/_/g, ' ') || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lead Source</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                    {activeOpp.lead_source || '—'}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Owner</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                    {activeOpp.owner ? `${activeOpp.owner.first_name} ${activeOpp.owner.last_name}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Created</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                    {activeOpp.created_at ? new Date(activeOpp.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">Select an opportunity to preview</div>
        )}
      </div>
    </div>
  );
}
