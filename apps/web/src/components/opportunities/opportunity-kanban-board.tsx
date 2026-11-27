'use client';

import React, { useState } from 'react';
import { APPROVED_OPPORTUNITY_STAGES, type OpportunityWithRelations } from '@/types/opportunities';
import { normalizeOpportunityStage } from '@/lib/forecast/forecast-utils';
import Link from 'next/link';
import {
  Building2,
  DollarSign,
  Calendar,
  ArrowRight,
  AlertTriangle,
  Clock,
  Briefcase,
  Layers,
  Inbox,
  CheckCircle2,
  TrendingUp,
  Target,
  FileCheck,
  Percent,
} from 'lucide-react';

interface OpportunityKanbanBoardProps {
  opportunities: OpportunityWithRelations[];
  isLoading?: boolean;
  onOpportunityClick?: (opp: OpportunityWithRelations) => void;
}

// Stage themes matching enterprise 60/30/10 design system
const STAGE_THEMES: Record<
  string,
  {
    pillBg: string;
    pillText: string;
    pillBorder: string;
    headerAccent: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    emptyText: string;
  }
> = {
  prospecting: {
    pillBg: 'bg-blue-50',
    pillText: 'text-blue-700',
    pillBorder: 'border-blue-200/80',
    headerAccent: 'bg-blue-500',
    icon: Target,
    accentColor: '#3b82f6',
    emptyText: 'No prospecting deals',
  },
  qualification: {
    pillBg: 'bg-indigo-50',
    pillText: 'text-indigo-700',
    pillBorder: 'border-indigo-200/80',
    headerAccent: 'bg-indigo-500',
    icon: CheckCircle2,
    accentColor: '#6366f1',
    emptyText: 'No deals in qualification',
  },
  needs_analysis: {
    pillBg: 'bg-purple-50',
    pillText: 'text-purple-700',
    pillBorder: 'border-purple-200/80',
    headerAccent: 'bg-purple-500',
    icon: Briefcase,
    accentColor: '#8b5cf6',
    emptyText: 'No needs analysis deals',
  },
  proposal_quote: {
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-700',
    pillBorder: 'border-amber-200/80',
    headerAccent: 'bg-amber-500',
    icon: FileCheck,
    accentColor: '#f59e0b',
    emptyText: 'No proposal quotes',
  },
  negotiation: {
    pillBg: 'bg-orange-50',
    pillText: 'text-orange-700',
    pillBorder: 'border-orange-200/80',
    headerAccent: 'bg-orange-500',
    icon: TrendingUp,
    accentColor: '#f97316',
    emptyText: 'No deals in negotiation',
  },
  closed_won: {
    pillBg: 'bg-[#eef2ff]',
    pillText: 'text-[#4361ee]',
    pillBorder: 'border-indigo-100/80',
    headerAccent: 'bg-[#4361ee]',
    icon: CheckCircle2,
    accentColor: '#059669',
    emptyText: 'No won deals yet',
  },
  closed_lost: {
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-700',
    pillBorder: 'border-rose-200/80',
    headerAccent: 'bg-rose-500',
    icon: AlertTriangle,
    accentColor: '#ef4444',
    emptyText: 'No lost deals',
  },
};

function formatRevenue(val: number | string | null | undefined): string | null {
  if (val == null || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num) || num <= 0) return null;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}k`;
  return `$${num.toLocaleString()}`;
}

function getAvatarProps(name: string) {
  const clean = name.trim().toUpperCase();
  const initials = clean ? clean.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'U';
  const hues = [
    'bg-[#eef2ff] text-[#4361ee] border-indigo-100',
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-amber-100 text-amber-800 border-amber-200',
  ];
  let sum = 0;
  for (let i = 0; i < clean.length; i++) sum += clean.charCodeAt(i);
  return { initials, colorClass: hues[sum % hues.length] };
}

export function OpportunityKanbanBoard({
  opportunities,
  isLoading = false,
  onOpportunityClick,
}: OpportunityKanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Group opportunities by canonical stage
  const grouped = APPROVED_OPPORTUNITY_STAGES.reduce<Record<string, OpportunityWithRelations[]>>(
    (acc, stage) => {
      acc[stage.id] = opportunities.filter((o) => normalizeOpportunityStage(o.stage) === stage.id);
      return acc;
    },
    {}
  );

  const totalOppsCount = opportunities.length;
  const totalPipelineRevenue = opportunities.reduce(
    (sum, opp) => sum + (Number(opp.amount) || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3.5 min-h-[640px]">
        {APPROVED_OPPORTUNITY_STAGES.map((s) => (
          <div key={s.id} className="flex flex-col bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 animate-pulse">
            <div className="flex items-center justify-between mb-3.5">
              <div className="h-4 bg-slate-200 rounded w-20" />
              <div className="h-5 w-6 bg-slate-200 rounded-full" />
            </div>
            <div className="space-y-3 flex-1">
              <div className="h-28 bg-white rounded-xl border border-slate-200/60" />
              <div className="h-28 bg-white rounded-xl border border-slate-200/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Board Summary Metric Strip with CRMHUB Pill & Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Deals</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalOppsCount}</p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-[#eef2ff] text-[#4361ee] flex items-center justify-center font-bold">
            <Briefcase className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-gradient-to-tr from-[#3a5bf0] to-[#4361ee] rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/25 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-100">Total Pipeline Value</p>
            <p className="text-2xl font-black text-white mt-1">
              ${(totalPipelineRevenue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k
            </p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Negotiations</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {grouped.negotiation?.length || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Target className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Closed Won</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {grouped.closed_won?.length || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-[#eef2ff] text-[#4361ee] flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Mobile Horizontal Snap Carousel / Desktop Multi-Column Grid */}
      <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3.5 min-h-[580px] overflow-x-auto pb-4 pt-1 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {APPROVED_OPPORTUNITY_STAGES.map((stage) => {
          const stageOpps = grouped[stage.id] || [];
          const totalAmount = stageOpps.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
          const theme = STAGE_THEMES[stage.id] || STAGE_THEMES.prospecting;
          const StageIcon = theme.icon;

          return (
            <div
              key={stage.id}
              className="flex flex-col bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition-all duration-200 shrink-0 w-[85vw] sm:w-auto min-w-[280px] sm:min-w-0 snap-center"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: stage.color || theme.accentColor }}
                />

                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`h-6 w-6 rounded-md flex items-center justify-center text-xs font-semibold ${theme.pillBg} ${theme.pillText} border ${theme.pillBorder} shrink-0`}
                    >
                      <StageIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800 truncate">
                          {stage.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60">
                          {stageOpps.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {totalAmount > 0 && (
                    <span className="text-[11px] font-bold text-[#4361ee] shrink-0">
                      ${(totalAmount / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>
              </div>

              {/* Column Body */}
              <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-270px)]">
                {stageOpps.length === 0 ? (
                  <div className="h-36 border border-dashed border-slate-200/90 rounded-xl bg-white/40 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400">
                      <Inbox className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {theme.emptyText}
                    </span>
                  </div>
                ) : (
                  stageOpps.map((opp) => {
                    const formattedAmt = formatRevenue(opp.amount);
                    const isSelected = activeCardId === opp.id;
                    const ownerName = opp.owner
                      ? `${opp.owner.first_name || ''} ${opp.owner.last_name || ''}`.trim() ||
                        opp.owner.email.split('@')[0]
                      : null;
                    const avatar = ownerName ? getAvatarProps(ownerName) : null;

                    return (
                      <div
                        key={opp.id}
                        onClick={() => {
                          setActiveCardId(opp.id);
                          onOpportunityClick?.(opp);
                        }}
                        className={`group relative p-3.5 bg-white hover:bg-slate-50/50 border rounded-xl shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? 'border-[#4361ee] ring-2 ring-[#4361ee]/10'
                            : 'border-slate-200/80 hover:border-indigo-300'
                        }`}
                      >
                        {/* Header: Deal Name + Link */}
                        <div className="flex items-start justify-between gap-1.5">
                          <Link
                            href={`/opportunities/${opp.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-sm text-slate-900 group-hover:text-[#4361ee] transition line-clamp-1 flex items-center gap-1.5 flex-1 min-w-0"
                            title={opp.name}
                          >
                            <span className="truncate">{opp.name}</span>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[#4361ee]" />
                          </Link>

                          {opp.probability !== undefined && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px] shrink-0 border border-slate-200/50 font-mono">
                              <Percent className="h-2.5 w-2.5" />
                              {opp.probability}%
                            </span>
                          )}
                        </div>

                        {/* Stalled / Aging tags */}
                        {opp.is_stalled && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 w-fit">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            <span>Stalled ({opp.days_in_stage ?? 14}d in stage)</span>
                          </div>
                        )}

                        {/* Linked Account */}
                        {opp.account && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{opp.account.name}</span>
                          </div>
                        )}

                        {/* Next Step / Target Close */}
                        {(opp.next_step || opp.close_date) && (
                          <div className="space-y-1 text-xs text-slate-500 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                            {opp.next_step && (
                              <p className="line-clamp-1 text-[11px] italic text-slate-600">
                                <strong>Next:</strong> {opp.next_step}
                              </p>
                            )}
                            {opp.close_date && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                <span>Target: {new Date(opp.close_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer: Amount + Rep Avatar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                          {formattedAmt ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[#4361ee] bg-[#eef2ff]/80 border border-indigo-100/60 text-[11px]">
                              <DollarSign className="h-3 w-3 -mr-0.5 text-[#4361ee]" />
                              {formattedAmt}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No value</span>
                          )}

                          {ownerName && avatar ? (
                            <div className="flex items-center gap-1.5 shrink-0 max-w-[130px]" title={`Owner: ${ownerName}`}>
                              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${avatar.colorClass} shrink-0`}>
                                {avatar.initials}
                              </div>
                              <span className="text-[11px] text-slate-600 font-medium truncate">{ownerName}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
