'use client';

import React, { useState } from 'react';
import type { CampaignWithRelations } from '@/types/campaigns';
import Link from 'next/link';
import {
  Megaphone,
  DollarSign,
  Calendar,
  ArrowRight,
  Layers,
  Inbox,
  PlayCircle,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Tag,
} from 'lucide-react';

interface CampaignKanbanBoardProps {
  campaigns: CampaignWithRelations[];
  isLoading?: boolean;
  onCampaignClick?: (campaign: CampaignWithRelations) => void;
}

const CAMPAIGN_STATUSES = [
  { id: 'planning', name: 'Planning', color: '#6366f1', icon: Clock },
  { id: 'active', name: 'Active / In Progress', color: '#10b981', icon: PlayCircle },
  { id: 'completed', name: 'Completed', color: '#059669', icon: CheckCircle2 },
  { id: 'on_hold', name: 'On Hold', color: '#f59e0b', icon: PauseCircle },
  { id: 'cancelled', name: 'Cancelled', color: '#ef4444', icon: XCircle },
] as const;

function normalizeStatus(status?: string | null): string {
  const norm = (status || 'planning').toLowerCase();
  if (norm.includes('plan')) return 'planning';
  if (norm.includes('act') || norm.includes('prog')) return 'active';
  if (norm.includes('comp')) return 'completed';
  if (norm.includes('hold')) return 'on_hold';
  if (norm.includes('canc')) return 'cancelled';
  return 'planning';
}

function formatRevenue(val: number | string | null | undefined): string | null {
  if (val == null || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num) || num <= 0) return null;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}k`;
  return `$${num.toLocaleString()}`;
}

export function CampaignKanbanBoard({
  campaigns,
  isLoading = false,
  onCampaignClick,
}: CampaignKanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Group campaigns by status
  const grouped = CAMPAIGN_STATUSES.reduce<Record<string, CampaignWithRelations[]>>((acc, s) => {
    acc[s.id] = campaigns.filter((c) => normalizeStatus(c.status) === s.id);
    return acc;
  }, {});

  const totalExpectedRevenue = campaigns.reduce(
    (sum, c) => sum + (Number(c.expected_revenue) || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 min-h-[640px]">
        {CAMPAIGN_STATUSES.map((s) => (
          <div key={s.id} className="flex flex-col bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-20 mb-3.5" />
            <div className="space-y-3 flex-1">
              <div className="h-28 bg-white rounded-xl border border-slate-200/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Board Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Marketing Campaigns Pipeline
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {campaigns.length} total campaign{campaigns.length === 1 ? '' : 's'} across {CAMPAIGN_STATUSES.length} stages
              </span>
            </div>
          </div>
        </div>

        {totalExpectedRevenue > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200/80 shadow-2xs text-xs font-semibold text-slate-700">
            <span className="text-slate-400 uppercase text-[10px] tracking-wide font-bold">Total Expected Revenue:</span>
            <span className="text-emerald-600 font-bold">
              ${(totalExpectedRevenue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k
            </span>
          </div>
        )}
      </div>

      {/* Mobile Horizontal Snap Carousel / Desktop Multi-Column Grid */}
      <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 min-h-[580px] overflow-x-auto pb-4 pt-1 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {CAMPAIGN_STATUSES.map((status) => {
          const statusCampaigns = grouped[status.id] || [];
          const statusRevenue = statusCampaigns.reduce(
            (sum, c) => sum + (Number(c.expected_revenue) || 0),
            0
          );
          const StatusIcon = status.icon;

          return (
            <div
              key={status.id}
              className="flex flex-col bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition-all duration-200 shrink-0 w-[85vw] sm:w-auto min-w-[280px] sm:min-w-0 snap-center"
            >
              {/* Header */}
              <div className="p-3.5 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: status.color }}
                />

                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-md flex items-center justify-center text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      <StatusIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-800 truncate">
                        {status.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60">
                        {statusCampaigns.length}
                      </span>
                    </div>
                  </div>

                  {statusRevenue > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 shrink-0">
                      ${(statusRevenue / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-270px)]">
                {statusCampaigns.length === 0 ? (
                  <div className="h-36 border border-dashed border-slate-200/90 rounded-xl bg-white/40 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400">
                      <Inbox className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      No campaigns in {status.name.toLowerCase()}
                    </span>
                  </div>
                ) : (
                  statusCampaigns.map((camp) => {
                    const formattedRev = formatRevenue(camp.expected_revenue);
                    const formattedBudget = formatRevenue(camp.budget_cost);
                    const isSelected = activeCardId === camp.id;

                    return (
                      <div
                        key={camp.id}
                        onClick={() => {
                          setActiveCardId(camp.id);
                          onCampaignClick?.(camp);
                        }}
                        className={`group relative p-3.5 bg-white hover:bg-slate-50/50 border rounded-xl shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                            : 'border-slate-200/80 hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <Link
                            href={`/campaigns/${camp.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition line-clamp-1 flex items-center gap-1.5 flex-1 min-w-0"
                            title={camp.campaign_name}
                          >
                            <span className="truncate">{camp.campaign_name}</span>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-emerald-600" />
                          </Link>

                          {camp.campaign_type && (
                            <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 border border-slate-200/50">
                              {camp.campaign_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        {/* Dates */}
                        {(camp.start_date || camp.end_date) && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>
                              {camp.start_date ? new Date(camp.start_date).toLocaleDateString() : 'TBD'} &rarr;{' '}
                              {camp.end_date ? new Date(camp.end_date).toLocaleDateString() : 'Ongoing'}
                            </span>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                          {formattedRev ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 text-[11px]">
                              <DollarSign className="h-3 w-3 -mr-0.5 text-emerald-600" />
                              {formattedRev} exp
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No exp revenue</span>
                          )}

                          {formattedBudget && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              Cost: {formattedBudget}
                            </span>
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
