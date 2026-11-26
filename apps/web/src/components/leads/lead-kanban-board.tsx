'use client';

import React, { useState } from 'react';
import type { LeadWithRelations } from '@/types/leads';
import { CANONICAL_LEAD_STAGES } from '@/types/leads';
import {
  Building2,
  Mail,
  Phone,
  DollarSign,
  UserCheck,
  ArrowRight,
  TrendingUp,
  Inbox,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  PhoneCall,
  FileText,
  XCircle,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface LeadKanbanBoardProps {
  leads: LeadWithRelations[];
  isLoading?: boolean;
  onLeadClick?: (lead: LeadWithRelations) => void;
  onStageChange?: (leadId: string, newStage: string) => Promise<void> | void;
}

// Stage styling metadata: brand-consistent colors, badges, and accents
const STAGE_THEMES: Record<
  string,
  {
    pillBg: string;
    pillText: string;
    pillBorder: string;
    headerAccent: string;
    headerBg: string;
    cardBorderHover: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    emptyText: string;
  }
> = {
  new: {
    pillBg: 'bg-blue-50',
    pillText: 'text-blue-700',
    pillBorder: 'border-blue-200/80',
    headerAccent: 'bg-blue-500',
    headerBg: 'bg-gradient-to-r from-blue-50/60 to-transparent',
    cardBorderHover: 'hover:border-blue-400',
    icon: Sparkles,
    accentColor: '#3b82f6',
    emptyText: 'No new incoming leads',
  },
  contacted: {
    pillBg: 'bg-purple-50',
    pillText: 'text-purple-700',
    pillBorder: 'border-purple-200/80',
    headerAccent: 'bg-purple-500',
    headerBg: 'bg-gradient-to-r from-purple-50/60 to-transparent',
    cardBorderHover: 'hover:border-purple-400',
    icon: PhoneCall,
    accentColor: '#8b5cf6',
    emptyText: 'No leads in outreach',
  },
  qualified: {
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-700',
    pillBorder: 'border-emerald-200/80',
    headerAccent: 'bg-emerald-500',
    headerBg: 'bg-gradient-to-r from-emerald-50/60 to-transparent',
    cardBorderHover: 'hover:border-emerald-400',
    icon: CheckCircle2,
    accentColor: '#10b981',
    emptyText: 'No qualified prospects',
  },
  proposal: {
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-700',
    pillBorder: 'border-amber-200/80',
    headerAccent: 'bg-amber-500',
    headerBg: 'bg-gradient-to-r from-amber-50/60 to-transparent',
    cardBorderHover: 'hover:border-amber-400',
    icon: FileText,
    accentColor: '#f59e0b',
    emptyText: 'No active proposals',
  },
  lost: {
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-700',
    pillBorder: 'border-rose-200/80',
    headerAccent: 'bg-rose-500',
    headerBg: 'bg-gradient-to-r from-rose-50/60 to-transparent',
    cardBorderHover: 'hover:border-rose-400',
    icon: XCircle,
    accentColor: '#ef4444',
    emptyText: 'No lost leads',
  },
  convert: {
    pillBg: 'bg-teal-50',
    pillText: 'text-teal-700',
    pillBorder: 'border-teal-200/80',
    headerAccent: 'bg-teal-600',
    headerBg: 'bg-gradient-to-r from-teal-50/60 to-transparent',
    cardBorderHover: 'hover:border-teal-400',
    icon: TrendingUp,
    accentColor: '#0d9488',
    emptyText: 'Ready to convert',
  },
};

// Helper to format currency cleanly
function formatRevenue(val: number | string | null | undefined): string | null {
  if (val == null || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num) || num <= 0) return null;
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}k`;
  }
  return `$${num.toLocaleString()}`;
}

// Generate consistent soft avatar initials & background
function getAvatarProps(name: string) {
  const clean = name.trim().toUpperCase();
  const initials = clean
    ? clean
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
    : 'U';

  const hues = [
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
  ];
  let charSum = 0;
  for (let i = 0; i < clean.length; i++) charSum += clean.charCodeAt(i);
  const colorClass = hues[charSum % hues.length];

  return { initials, colorClass };
}

export function LeadKanbanBoard({
  leads,
  isLoading = false,
  onLeadClick,
}: LeadKanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Group leads by canonical status
  const groupedLeads = CANONICAL_LEAD_STAGES.reduce<Record<string, LeadWithRelations[]>>(
    (acc, stage) => {
      acc[stage.id] = leads.filter(
        (lead) => (lead.status || 'new').toLowerCase() === stage.id
      );
      return acc;
    },
    {}
  );

  // Board-level totals
  const totalLeadsCount = leads.length;
  const totalPipelineRevenue = leads.reduce(
    (sum, lead) => sum + (Number(lead.annual_revenue) || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 min-h-[640px]">
        {CANONICAL_LEAD_STAGES.map((s) => (
          <div
            key={s.id}
            className="flex flex-col bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 animate-pulse"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-5 w-6 bg-slate-200 rounded-full" />
            </div>
            <div className="space-y-3 flex-1">
              <div className="h-32 bg-white rounded-xl border border-slate-200/60" />
              <div className="h-32 bg-white rounded-xl border border-slate-200/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Board Summary Metric Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Kanban Pipeline
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {totalLeadsCount} active lead{totalLeadsCount === 1 ? '' : 's'} across {CANONICAL_LEAD_STAGES.length} stages
              </span>
            </div>
          </div>
        </div>

        {totalPipelineRevenue > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200/80 shadow-2xs text-xs font-semibold text-slate-700">
            <span className="text-slate-400 uppercase text-[10px] tracking-wide font-bold">Total Pipeline:</span>
            <span className="text-emerald-600 font-bold">
              ${(totalPipelineRevenue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k
            </span>
          </div>
        )}
      </div>

      {/* Mobile Horizontal Snap Carousel / Desktop Multi-Column Grid */}
      <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 min-h-[580px] overflow-x-auto pb-4 pt-1 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {CANONICAL_LEAD_STAGES.map((stage) => {
          const stageLeads = groupedLeads[stage.id] || [];
          const totalRevenue = stageLeads.reduce(
            (sum, lead) => sum + (Number(lead.annual_revenue) || 0),
            0
          );
          const theme = STAGE_THEMES[stage.id] || STAGE_THEMES.new;
          const StageIcon = theme.icon;

          return (
            <div
              key={stage.id}
              className="flex flex-col bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition-all duration-200 shrink-0 w-[85vw] sm:w-auto min-w-[280px] sm:min-w-0 snap-center"
            >
              {/* Column Header */}
              <div
                className={`p-3.5 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs relative overflow-hidden`}
              >
                {/* Stage top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: stage.color || theme.accentColor }}
                />

                <div className="flex items-center justify-between gap-2 pt-0.5">
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
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {totalRevenue > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 shrink-0">
                      ${(totalRevenue / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>
              </div>

              {/* Column Body / Cards List */}
              <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-270px)]">
                {stageLeads.length === 0 ? (
                  <div className="h-36 border border-dashed border-slate-200/90 rounded-xl bg-white/40 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400">
                      <Inbox className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {theme.emptyText}
                    </span>
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
                    const primaryTitle = lead.title || fullName || 'Untitled Lead';
                    const hasSubTitle = Boolean(lead.title && fullName && lead.title !== fullName);
                    const formattedRev = formatRevenue(lead.annual_revenue);
                    const isSelected = activeCardId === lead.id;

                    // Assigned rep avatar & name
                    const assignedRep = lead.sub_owner || lead.lead_owner;
                    const repName = assignedRep
                      ? `${assignedRep.first_name || ''} ${assignedRep.last_name || ''}`.trim() ||
                        assignedRep.email.split('@')[0]
                      : null;
                    const avatar = repName ? getAvatarProps(repName) : null;

                    return (
                      <div
                        key={lead.id}
                        onClick={() => {
                          setActiveCardId(lead.id);
                          onLeadClick?.(lead);
                        }}
                        className={`group relative p-3.5 bg-white hover:bg-slate-50/50 border rounded-xl shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                            : `border-slate-200/80 ${theme.cardBorderHover}`
                        }`}
                      >
                        {/* Card Header: Primary Title + Quick Link Arrow */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/leads/${lead.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition line-clamp-1 flex items-center gap-1.5"
                              title={primaryTitle}
                            >
                              <span className="truncate">{primaryTitle}</span>
                              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-emerald-600" />
                            </Link>
                            {hasSubTitle && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                                {fullName}
                              </p>
                            )}
                          </div>

                          {lead.lead_source && (
                            <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 border border-slate-200/50">
                              {lead.lead_source.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        {/* Company Name */}
                        {lead.company_name && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{lead.company_name}</span>
                          </div>
                        )}

                        {/* Contact Channels (Email / Phone) */}
                        {(lead.email || lead.phone) && (
                          <div className="space-y-1 text-xs text-slate-500 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                            {lead.email && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate" title={lead.email}>
                                  {lead.email}
                                </span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{lead.phone}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Card Footer: Value Pill + Assignee Avatar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                          {/* Deal Value Pill */}
                          {formattedRev ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 text-[11px]">
                              <DollarSign className="h-3 w-3 -mr-0.5 text-emerald-600" />
                              {formattedRev}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              No revenue recorded
                            </span>
                          )}

                          {/* Owner / Assignee Pill */}
                          {repName && avatar ? (
                            <div
                              className="flex items-center gap-1.5 shrink-0 max-w-[130px]"
                              title={
                                lead.sub_owner
                                  ? `Assigned BDO: ${repName}`
                                  : `Lead Owner: ${repName}`
                              }
                            >
                              <div
                                className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${avatar.colorClass} shrink-0`}
                              >
                                {avatar.initials}
                              </div>
                              <span className="text-[11px] text-slate-600 font-medium truncate">
                                {repName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Unassigned
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
