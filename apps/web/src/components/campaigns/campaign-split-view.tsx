'use client';

import React, { useState } from 'react';
import type { CampaignWithRelations, CampaignRecord } from '@/types/campaigns';
import Link from 'next/link';
import {
  Megaphone,
  Calendar,
  DollarSign,
  ExternalLink,
  Edit2,
  Users,
} from 'lucide-react';

interface CampaignSplitViewProps {
  campaigns: CampaignWithRelations[];
  selectedCampaignId?: string | null;
  onSelectCampaign?: (campaign: CampaignWithRelations) => void;
  onEditCampaign?: (campaign: CampaignRecord) => void;
  isLoading?: boolean;
}

export function CampaignSplitView({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onEditCampaign,
  isLoading = false,
}: CampaignSplitViewProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedCampaignId || (campaigns.length > 0 ? campaigns[0].id : null)
  );

  const activeId = selectedCampaignId ?? internalSelectedId;
  const activeCampaign = campaigns.find((c) => c.id === activeId) || campaigns[0];

  const handleSelect = (campaign: CampaignWithRelations) => {
    setInternalSelectedId(campaign.id);
    onSelectCampaign?.(campaign);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#eef2ff] text-[#4361ee]">Completed</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">In Progress</span>;
      case 'planned':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#eef2ff] text-[#4361ee]">Planned</span>;
      case 'aborted':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Aborted</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">{status || 'New'}</span>;
    }
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

  if (campaigns.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
        <p className="text-sm text-slate-500">No campaigns found matching active criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[750px]">
      {/* Left List Pane */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
          <span>Campaigns ({campaigns.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {campaigns.map((c) => {
            const isSelected = c.id === activeCampaign?.id;
            return (
              <div
                key={c.id}
                onClick={() => handleSelect(c)}
                className={`p-3.5 cursor-pointer transition text-left ${
                  isSelected
                    ? 'bg-[#eef2ff]/70 border-l-4 border-indigo-100'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {c.campaign_name}
                    </p>
                    <p className="text-xs text-slate-500 capitalize mt-0.5">
                      {c.campaign_type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  {getStatusBadge(c.status)}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    ${Number(c.expected_revenue || 0).toLocaleString()}
                  </span>
                  {c.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {c.start_date}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Detail Preview Pane */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 overflow-y-auto shadow-xs flex flex-col justify-between">
        {activeCampaign ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{activeCampaign.campaign_name}</h2>
                  {getStatusBadge(activeCampaign.status)}
                </div>
                <p className="text-xs text-slate-500 capitalize mt-1">
                  Type: {activeCampaign.campaign_type?.replace(/_/g, ' ')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onEditCampaign && (
                  <button
                    type="button"
                    onClick={() => onEditCampaign(activeCampaign as unknown as CampaignRecord)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Edit Campaign"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                <Link
                  href={`/campaigns/${activeCampaign.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4361ee] hover:bg-[#4361ee] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  <span>Full View</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Expected Revenue</span>
                <span className="text-base font-bold text-[#4361ee] mt-1 block">
                  ${Number(activeCampaign.expected_revenue || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Budget Cost</span>
                <span className="text-base font-bold text-slate-800 mt-1 block">
                  ${Number(activeCampaign.budget_cost || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Actual Cost</span>
                <span className="text-base font-bold text-slate-800 mt-1 block">
                  ${Number(activeCampaign.actual_cost || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Timeline & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Start Date</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block">{activeCampaign.start_date || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">End Date</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block">{activeCampaign.end_date || '—'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Expected Response</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                    {activeCampaign.expected_response != null ? `${activeCampaign.expected_response}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Responses in Campaign</span>
                  <span className="text-slate-800 font-medium text-sm mt-0.5 block">
                    {activeCampaign.responses_in_campaign ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {activeCampaign.description && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Description</span>
                <p className="whitespace-pre-wrap">{activeCampaign.description}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">Select a campaign to preview</div>
        )}
      </div>
    </div>
  );
}
