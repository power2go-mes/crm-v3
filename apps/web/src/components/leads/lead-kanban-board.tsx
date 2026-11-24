'use client';

import React from 'react';
import type { LeadWithRelations } from '@/types/leads';
import { CANONICAL_LEAD_STAGES } from '@/types/leads';
import { Building2, Mail, Phone, DollarSign, UserCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface LeadKanbanBoardProps {
  leads: LeadWithRelations[];
  isLoading?: boolean;
  onLeadClick?: (lead: LeadWithRelations) => void;
}

export function LeadKanbanBoard({
  leads,
  isLoading = false,
  onLeadClick,
}: LeadKanbanBoardProps) {
  // Group leads by status
  const groupedLeads = CANONICAL_LEAD_STAGES.reduce<Record<string, LeadWithRelations[]>>((acc, stage) => {
    acc[stage.id] = leads.filter(
      (lead) => lead.status?.toLowerCase() === stage.id
    );
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {CANONICAL_LEAD_STAGES.map((s) => (
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
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 min-h-[600px] overflow-x-auto pb-4">
      {CANONICAL_LEAD_STAGES.map((stage) => {
        const stageLeads = groupedLeads[stage.id] || [];
        const totalRevenue = stageLeads.reduce((sum, lead) => sum + (Number(lead.annual_revenue) || 0), 0);

        return (
          <div
            key={stage.id}
            className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-xs flex-1 min-w-[240px]"
          >
            {/* Column Header */}
            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs uppercase tracking-wider text-slate-800">
                  {stage.name}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {stageLeads.length}
                </span>
              </div>
              {totalRevenue > 0 && (
                <span className="text-[11px] font-bold text-emerald-600">
                  ${(totalRevenue / 1000).toFixed(0)}k
                </span>
              )}
            </div>

            {/* Column Body / Cards */}
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {stageLeads.length === 0 ? (
                <div className="h-28 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  No leads in {stage.name}
                </div>
              ) : (
                stageLeads.map((lead) => {
                  const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Untitled Lead';
                  return (
                    <div
                      key={lead.id}
                      onClick={() => onLeadClick?.(lead)}
                      className="group p-3 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-emerald-500/50 rounded-lg shadow-2xs transition cursor-pointer flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          href={`/leads/${lead.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 transition line-clamp-1 flex items-center gap-1"
                        >
                          {leadName}
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </Link>
                      </div>

                      {lead.company_name && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{lead.company_name}</span>
                        </div>
                      )}

                      <div className="space-y-1 text-xs text-slate-500">
                        {lead.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-1 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        {lead.annual_revenue ? (
                          <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                            <DollarSign className="h-3 w-3" />
                            {Number(lead.annual_revenue).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">No value</span>
                        )}

                        {lead.sub_owner ? (
                          <span className="text-slate-500 flex items-center gap-1" title="Assigned BDO">
                            <UserCheck className="h-3 w-3 text-emerald-600" />
                            <span className="truncate max-w-[80px]">
                              {lead.sub_owner.first_name || lead.sub_owner.email.split('@')[0]}
                            </span>
                          </span>
                        ) : lead.lead_owner ? (
                          <span className="text-slate-400 truncate max-w-[80px]" title="Lead Owner">
                            {lead.lead_owner.first_name || lead.lead_owner.email.split('@')[0]}
                          </span>
                        ) : null}
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
  );
}
