'use client';

import React, { useState } from 'react';
import type { LeadWithRelations, LeadUpdate, LeadConversionPayload } from '@/types/leads';
import { LeadStatusBadge } from './lead-status-badge';
import Link from 'next/link';
import {
  Building2,
  Mail,
  Phone,
  DollarSign,
  UserCheck,
  MapPin,
  ExternalLink,
  Edit2,
  Shuffle,
} from 'lucide-react';

interface LeadSplitViewProps {
  leads: LeadWithRelations[];
  selectedLeadId?: string | null;
  onSelectLead?: (lead: LeadWithRelations) => void;
  onEditLead?: (lead: LeadWithRelations) => void;
  onConvertLead?: (lead: LeadWithRelations) => void;
  isLoading?: boolean;
  detailHref?: (id: string) => string;
  onOpenDetail?: (id: string) => void;
}

export function LeadSplitView({
  leads,
  selectedLeadId,
  onSelectLead,
  onEditLead,
  onConvertLead,
  isLoading = false,
  detailHref,
  onOpenDetail,
}: LeadSplitViewProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedLeadId || (leads.length > 0 ? leads[0].id : null)
  );

  const activeId = selectedLeadId ?? internalSelectedId;
  const activeLead = leads.find((l) => l.id === activeId) || leads[0];

  const handleSelect = (lead: LeadWithRelations) => {
    setInternalSelectedId(lead.id);
    onSelectLead?.(lead);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[700px] animate-pulse">
        <div className="lg:col-span-5 bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/60 rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-7 bg-slate-900/50 border border-slate-800 rounded-xl p-6" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-slate-500">
        No leads available for split preview.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[650px]">
      {/* Left Pane: List */}
      <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[720px]">
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Leads ({leads.length})</span>
        </div>
        <div className="divide-y divide-slate-800/60 overflow-y-auto flex-1">
          {leads.map((lead) => {
            const isSelected = lead.id === activeLead?.id;
            const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Untitled Lead';

            return (
              <div
                key={lead.id}
                onClick={() => handleSelect(lead)}
                className={`p-3.5 transition cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected ? 'bg-emerald-600/40 border-l-4 border-emerald-200' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-slate-100 truncate">{leadName}</div>
                  <div className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                    {lead.company_name && <span>{lead.company_name}</span>}
                    {lead.company_name && lead.email && <span>•</span>}
                    {lead.email && <span className="truncate">{lead.email}</span>}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <LeadStatusBadge status={lead.status} />
                  {lead.annual_revenue && (
                    <span className="text-[11px] font-semibold text-emerald-400">
                      ${Number(lead.annual_revenue).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Pane: Detail Quick Preview */}
      <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {activeLead ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">
                    {`${activeLead.first_name || ''} ${activeLead.last_name || ''}`.trim() || 'Untitled Lead'}
                  </h3>
                  <LeadStatusBadge status={activeLead.status} />
                </div>
                {activeLead.company_name && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>{activeLead.company_name}</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEditLead?.(activeLead)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition inline-flex items-center gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>

                {!activeLead.is_convert && (
                  <button
                    type="button"
                    onClick={() => onConvertLead?.(activeLead)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Convert</span>
                  </button>
                )}

                <Link
                  href={detailHref?.(activeLead.id) ?? `/leads/${activeLead.id}`}
                  onClick={() => onOpenDetail?.(activeLead.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-600 text-xs font-medium text-white transition inline-flex items-center gap-1.5 shadow-sm"
                >
                  <span>Full View</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-5 space-y-6 overflow-y-auto flex-1 text-sm text-slate-200">
              {/* Contact Information */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                    <Mail className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[10px] text-slate-500 uppercase">Email</span>
                      <span className="truncate block font-medium">{activeLead.email || '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                    <Phone className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[10px] text-slate-500 uppercase">Phone</span>
                      <span className="truncate block font-medium">{activeLead.phone || '—'}</span>
                    </div>
                  </div>

                  {(activeLead.city || activeLead.country) && (
                    <div className="flex items-center gap-2 p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                      <MapPin className="h-4 w-4 text-rose-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-[10px] text-slate-500 uppercase">Location</span>
                        <span className="truncate block font-medium">
                          {[activeLead.city, activeLead.state, activeLead.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Commercial & Qualification */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Commercial & Source
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                    <span className="block text-[10px] text-slate-500 uppercase">Annual Revenue</span>
                    <span className="font-semibold text-emerald-400 text-sm">
                      {activeLead.annual_revenue ? `$${Number(activeLead.annual_revenue).toLocaleString()}` : '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                    <span className="block text-[10px] text-slate-500 uppercase">Industry</span>
                    <span className="font-medium text-sm">{activeLead.industry || '—'}</span>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                    <span className="block text-[10px] text-slate-500 uppercase">Lead Source</span>
                    <span className="font-medium text-sm">{activeLead.lead_source || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Ownership */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Sales Assignment
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                    <span className="block text-[10px] text-slate-500 uppercase">Lead Owner</span>
                    <span className="font-medium text-sm">
                      {activeLead.lead_owner?.first_name ? `${activeLead.lead_owner.first_name} (${activeLead.lead_owner.email})` : '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                    <span className="block text-[10px] text-slate-500 uppercase">Assigned BDO</span>
                    <span className="font-medium text-sm flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                      {activeLead.sub_owner?.first_name ? `${activeLead.sub_owner.first_name} (${activeLead.sub_owner.email})` : 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">Select a lead to preview.</div>
        )}
      </div>
    </div>
  );
}
