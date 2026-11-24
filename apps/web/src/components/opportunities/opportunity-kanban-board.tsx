'use client';

import React from 'react';
import { APPROVED_OPPORTUNITY_STAGES, type OpportunityWithRelations } from '@/types/opportunities';
import { normalizeOpportunityStage } from '@/lib/forecast/forecast-utils';
import Link from 'next/link';
import { Building2, DollarSign, Calendar, User, ArrowRight, AlertTriangle, Clock } from 'lucide-react';

interface OpportunityKanbanBoardProps {
  opportunities: OpportunityWithRelations[];
  isLoading?: boolean;
}

export function OpportunityKanbanBoard({
  opportunities,
  isLoading = false,
}: OpportunityKanbanBoardProps) {
  // Group opportunities by stage using canonical normalization
  const grouped = APPROVED_OPPORTUNITY_STAGES.reduce<Record<string, OpportunityWithRelations[]>>(
    (acc, stage) => {
      acc[stage.id] = opportunities.filter((o) => normalizeOpportunityStage(o.stage) === stage.id);
      return acc;
    },
    {}
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {APPROVED_OPPORTUNITY_STAGES.map((s) => (
          <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-3 animate-pulse">
            <div className="h-5 bg-slate-100 rounded w-1/2 mb-3" />
            <div className="space-y-3">
              <div className="h-28 bg-slate-100 rounded-lg" />
              <div className="h-28 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3 min-h-[600px] overflow-x-auto pb-4">
      {APPROVED_OPPORTUNITY_STAGES.map((stage) => {
        const stageOpps = grouped[stage.id] || [];
        const totalAmount = stageOpps.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

        return (
          <div
            key={stage.id}
            className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-xs flex-1 min-w-[210px]"
          >
            {/* Column Header */}
            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs uppercase tracking-wider text-slate-800">
                  {stage.name}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {stageOpps.length}
                </span>
              </div>
              {totalAmount > 0 && (
                <span className="text-[11px] font-bold text-emerald-600">
                  ${(totalAmount / 1000).toFixed(0)}k
                </span>
              )}
            </div>

            {/* Column Body */}
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {stageOpps.length === 0 ? (
                <div className="h-24 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  No deals
                </div>
              ) : (
                stageOpps.map((opp) => (
                  <div
                    key={opp.id}
                    className="group p-3 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-emerald-500/50 rounded-lg shadow-2xs transition flex flex-col gap-2"
                  >
                    <Link
                      href={`/opportunities/${opp.id}`}
                      className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 transition line-clamp-1 flex items-center justify-between"
                    >
                      <span>{opp.name}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>

                    {/* Stalled or Aging Indicators */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {opp.is_stalled && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Stalled ({opp.days_in_stage ?? 14}d)
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {opp.days_in_stage ?? 0}d in stage
                      </span>
                    </div>

                    {opp.next_step && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                        Next: {opp.next_step}
                      </p>
                    )}

                    {opp.account && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{opp.account.name}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs mt-1 pt-2 border-t border-slate-100">
                      <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" />
                        {Number(opp.amount || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-semibold">
                        {opp.probability}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {opp.close_date}
                      </span>
                      {opp.owner && (
                        <span className="truncate max-w-[80px]">
                          {opp.owner.first_name || opp.owner.email.split('@')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
