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

// Stage styling metadata: modern CRMHUB colors, rounded badges, and soft tinted headers
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
    pillBg: 'bg-[#eef2ff]',
    pillText: 'text-[#4361ee]',
    pillBorder: 'border-indigo-100',
    headerAccent: 'bg-[#4361ee]',
    headerBg: 'bg-gradient-to-r from-indigo-50/70 to-white',
    cardBorderHover: 'hover:border-[#4361ee]/60',
    icon: Sparkles,
    accentColor: '#4361ee',
    emptyText: 'No new incoming leads',
  },
  contacted: {
    pillBg: 'bg-purple-50',
    pillText: 'text-purple-600',
    pillBorder: 'border-purple-100',
    headerAccent: 'bg-purple-500',
    headerBg: 'bg-gradient-to-r from-purple-50/70 to-white',
    cardBorderHover: 'hover:border-purple-400',
    icon: PhoneCall,
    accentColor: '#8b5cf6',
    emptyText: 'No leads in outreach',
  },
  qualified: {
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-600',
    pillBorder: 'border-emerald-100',
    headerAccent: 'bg-emerald-500',
    headerBg: 'bg-gradient-to-r from-emerald-50/70 to-white',
    cardBorderHover: 'hover:border-emerald-400',
    icon: CheckCircle2,
    accentColor: '#10b981',
    emptyText: 'No qualified prospects',
  },
  proposal: {
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-600',
    pillBorder: 'border-amber-100',
    headerAccent: 'bg-amber-500',
    headerBg: 'bg-gradient-to-r from-amber-50/70 to-white',
    cardBorderHover: 'hover:border-amber-400',
    icon: FileText,
    accentColor: '#f59e0b',
    emptyText: 'No active proposals',
  },
  lost: {
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-600',
    pillBorder: 'border-rose-100',
    headerAccent: 'bg-rose-500',
    headerBg: 'bg-gradient-to-r from-rose-50/70 to-white',
    cardBorderHover: 'hover:border-rose-400',
    icon: XCircle,
    accentColor: '#ef4444',
    emptyText: 'No lost leads',
  },
  convert: {
    pillBg: 'bg-cyan-50',
    pillText: 'text-cyan-600',
    pillBorder: 'border-cyan-100',
    headerAccent: 'bg-cyan-500',
    headerBg: 'bg-gradient-to-r from-cyan-50/70 to-white',
    cardBorderHover: 'hover:border-cyan-400',
    icon: TrendingUp,
    accentColor: '#06b6d4',
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
      {/* Board Summary Metric Strip with CRMHUB Pill & Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Leads</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalLeadsCount}</p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-[#eef2ff] text-[#4361ee] flex items-center justify-center font-bold">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-gradient-to-tr from-[#3a5bf0] to-[#4361ee] rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/25 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-100">Total Pipeline</p>
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
            <p className="text-xs font-semibold text-slate-400">Qualified Deals</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {groupedLeads.qualified?.length || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Ready to Convert</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {groupedLeads.convert?.length || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Mobile Horizontal Snap Carousel / Desktop Multi-Column Grid */}
      <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 min-h-[580px] overflow-x-auto pb-4 pt-1 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
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
              className="flex flex-col bg-[#f8faff] border border-slate-100/90 rounded-3xl overflow-hidden shadow-2xs hover:shadow-xs transition-all duration-200 shrink-0 w-[85vw] sm:w-auto min-w-[280px] sm:min-w-0 snap-center"
            >
              {/* Column Header */}
              <div
                className={`p-3.5 border-b border-slate-100 bg-white relative overflow-hidden`}
              >
                {/* Stage top accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 rounded-t-full"
                  style={{ backgroundColor: stage.color || theme.accentColor }}
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`h-7 w-7 rounded-xl flex items-center justify-center text-xs font-bold ${theme.pillBg} ${theme.pillText} shrink-0`}
                    >
                      <StageIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800 truncate">
                          {stage.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f4f6fa] text-slate-500">
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {totalRevenue > 0 && (
                    <span className="text-[11px] font-bold text-[#4361ee] shrink-0">
                      ${(totalRevenue / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>
              </div>

              {/* Column Body / Cards List */}
              <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-270px)]">
                {stageLeads.length === 0 ? (
                  <div className="h-36 border border-dashed border-slate-200/80 rounded-2xl bg-white/50 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Inbox className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
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
                        className={`group relative p-3.5 bg-white hover:bg-slate-50/70 border rounded-2xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? 'border-[#4361ee] ring-2 ring-[#4361ee]/20'
                            : `border-slate-100 ${theme.cardBorderHover}`
                        }`}
                      >
                        {/* Card Header: Primary Title + Quick Link Arrow */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/leads/${lead.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-[#4361ee] transition line-clamp-1 flex items-center gap-1.5"
                              title={primaryTitle}
                            >
                              <span className="truncate">{primaryTitle}</span>
                              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[#4361ee]" />
                            </Link>
                            {hasSubTitle && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                                {fullName}
                              </p>
                            )}
                          </div>

                          {lead.lead_source && (
                            <span className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f4f6fa] text-slate-500 shrink-0">
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
                          <div className="space-y-1 text-xs text-slate-500 bg-[#f8faff] p-2 rounded-xl border border-slate-100">
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
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-bold text-[#4361ee] bg-[#eef2ff] text-[11px]">
                              <DollarSign className="h-3 w-3 -mr-0.5" />
                              {formattedRev}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-300 italic">
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
                              <span className="text-[11px] text-slate-600 font-semibold truncate">
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
