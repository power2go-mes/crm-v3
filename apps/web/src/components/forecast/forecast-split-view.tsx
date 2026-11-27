'use client';

import React, { useState } from 'react';
import type { OpportunityWithRelations } from '@/types/opportunities';
import { normalizeOpportunityStage, STAGE_CONFIG_MAP } from '@/lib/forecast/forecast-utils';
import Link from 'next/link';
import { ExternalLink, TrendingUp, Calendar, DollarSign, User } from 'lucide-react';

interface ForecastSplitViewProps {
  opportunities: OpportunityWithRelations[];
  selectedOppId?: string | null;
  onSelectOpp?: (opp: OpportunityWithRelations) => void;
  isLoading?: boolean;
}

export function ForecastSplitView({
  opportunities,
  selectedOppId,
  onSelectOpp,
  isLoading = false,
}: ForecastSplitViewProps) {
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
        <p className="text-sm text-slate-500">No forecast deals found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[750px]">
      {/* Left List Pane */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
          <span>Deals ({opportunities.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {opportunities.map((opp) => {
            const isSelected = opp.id === activeOpp?.id;
            const canonical = normalizeOpportunityStage(opp.stage);
            const amount = Number(opp.amount || 0);
            const defaultProb = canonical !== 'unassigned' ? STAGE_CONFIG_MAP[canonical].defaultProbability : 0;
            const prob = opp.probability != null && !isNaN(Number(opp.probability)) ? Number(opp.probability) : defaultProb;
            const weighted = canonical === 'closed_won' ? amount : canonical === 'closed_lost' ? 0 : (amount * prob) / 100;

            return (
              <div
                key={opp.id}
                onClick={() => handleSelect(opp)}
                className={`p-3.5 cursor-pointer transition text-left ${
                  isSelected
                    ? 'bg-[#eef2ff]/70 border-l-4 border-indigo-100'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{opp.name}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{opp.account?.name || 'No account'}</p>
                  </div>
                  <span className="text-xs font-bold text-[#4361ee]">
                    ${Math.round(weighted).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span className="capitalize">{opp.stage?.replace(/_/g, ' ')}</span>
                  <span>Amount: ${amount.toLocaleString()}</span>
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
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{activeOpp.name}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Account: {activeOpp.account?.name || '—'}
                </p>
              </div>

              <Link
                href={`/opportunities/${activeOpp.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4361ee] hover:bg-[#4361ee] text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                <span>Full Deal View</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Metrics */}
            {(() => {
              const canonical = normalizeOpportunityStage(activeOpp.stage);
              const amount = Number(activeOpp.amount || 0);
              const defaultProb = canonical !== 'unassigned' ? STAGE_CONFIG_MAP[canonical].defaultProbability : 0;
              const prob = activeOpp.probability != null && !isNaN(Number(activeOpp.probability)) ? Number(activeOpp.probability) : defaultProb;
              const weighted = canonical === 'closed_won' ? amount : canonical === 'closed_lost' ? 0 : (amount * prob) / 100;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Deal Amount</span>
                    <span className="text-base font-bold text-slate-900 mt-1 block">
                      ${amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Win Probability</span>
                    <span className="text-base font-bold text-[#4361ee] mt-1 block">
                      {prob}%
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Weighted Forecast</span>
                    <span className="text-base font-bold text-[#4361ee] mt-1 block">
                      ${Math.round(weighted).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Stage</span>
                <span className="text-slate-800 font-medium text-sm mt-0.5 block capitalize">
                  {activeOpp.stage?.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Close</span>
                <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                  {activeOpp.close_date || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Opportunity Owner</span>
                <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                  {activeOpp.owner ? `${activeOpp.owner.first_name} ${activeOpp.owner.last_name}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lead Source</span>
                <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                  {activeOpp.lead_source || '—'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">Select a deal to preview</div>
        )}
      </div>
    </div>
  );
}
