'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { CampaignMembers } from '@/components/campaigns/campaign-members';
import { CampaignForm } from '@/components/campaigns/campaign-form';
import { CampaignPipelineBar } from '@/components/campaigns/campaign-pipeline-bar';
import { RecordHistoryAudit } from '@/components/history/record-history-audit';
import type { CampaignRecord } from '@finlonexa/database';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Megaphone,
  DollarSign,
  TrendingUp,
  Users,
  Layers,
  Calendar,
  Activity,
  History,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Maximize2,
} from 'lucide-react';

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'details' | 'activity' | 'related' | 'notes' | 'history';

export default function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const campaignId = resolvedParams.id;

  const { user, profile, permissions, roleIds, hasPermission, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [notesList, setNotesList] = useState<{ id: string; content: string; date: string }[]>([]);

  const supabase = createClient();
  const signature = [...roleIds, ...permissions].sort().join('|');

  // Query Campaign Record
  const { data: campaign, isLoading: isCampaignLoading, error: campaignError, refetch } = useQuery({
    queryKey: ['crm', user?.id, 'campaigns', 'detail', campaignId, signature],
    enabled: !authLoading && !!user && !!profile?.is_active && hasPermission('campaigns.view'),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('campaigns_readable')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const [ownerRes, parentRes, childrenRes] = await Promise.all([
        data.campaign_owner_id
          ? supabase.from('user_profiles').select('id, first_name, last_name, email').eq('id', data.campaign_owner_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        data.parent_campaign_id
          ? supabase.from('campaigns').select('id, campaign_name').eq('id', data.parent_campaign_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('campaigns').select('id, campaign_name, status, expected_revenue').eq('parent_campaign_id', campaignId).order('campaign_name'),
      ]);

      return {
        ...data,
        owner: ownerRes.data,
        parent: parentRes.data,
        children: childrenRes.data || [],
      };
    },
  });

  // Query Linked Opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ['campaign-opportunities', campaignId],
    enabled: Boolean(campaignId && hasPermission('opportunities.view')),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(
          `
          id,
          name,
          stage,
          amount,
          probability,
          close_date,
          account:accounts(id, name)
        `
        )
        .eq('primary_campaign_source_id', campaignId)
        .order('amount', { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Update Status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus as any, updated_at: new Date().toISOString() })
        .eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', user?.id, 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      refetch();
    },
  });

  // Delete Campaign Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', user?.id, 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      router.push('/campaigns');
    },
  });

  const handleDelete = async () => {
    if (!campaign) return;
    if (window.confirm(`Are you sure you want to delete campaign "${campaign.campaign_name}"? This action cannot be undone.`)) {
      await deleteMutation.mutateAsync();
    }
  };

  if (isCampaignLoading) {
    return (
      <PageContainer maxWidth="full" className="min-h-full bg-[#f7f9fc]">
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-48" />
          <div className="h-28 bg-white rounded-xl" />
          <div className="h-16 bg-white rounded-xl" />
          <div className="h-96 bg-white rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (campaignError || !campaign) {
    return (
      <PageContainer maxWidth="full" className="min-h-full bg-[#f7f9fc]">
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Campaign Not Found</h2>
          <p className="text-sm text-slate-500">
            The requested marketing campaign does not exist or access is restricted.
          </p>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Campaigns</span>
          </Link>
        </div>
      </PageContainer>
    );
  }

  const ownerName = campaign.owner
    ? `${campaign.owner.first_name || ''} ${campaign.owner.last_name || ''}`.trim() || campaign.owner.email
    : 'Super Admin';

  const wonOpps = opportunities.filter((o) => o.stage === 'closed_won');
  const wonRevenue = wonOpps.reduce((acc, o) => acc + Number(o.amount || 0), 0);
  const actualCost = Number(campaign.actual_cost || 0);
  const budgetCost = Number(campaign.budget_cost || 0);
  const expectedRevenue = Number(campaign.expected_revenue || 0);

  const roiPercent =
    actualCost > 0
      ? Math.round(((wonRevenue - actualCost) / actualCost) * 100)
      : wonRevenue > 0
      ? 100
      : 0;

  return (
    <PageContainer maxWidth="full" className="min-h-full bg-[#f7f9fc]">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#4361ee] transition"
        >
          <span>Campaigns</span>
          <span aria-hidden="true">›</span>
          <span className="text-[#4361ee] font-medium">{campaign.campaign_name}</span>
        </Link>
      </div>

      {/* Main Record Header Card */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">{campaign.campaign_name}</h1>
            </div>

            {/* Key Summary Grid matching Image 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3 mt-7 text-sm text-slate-800">
              <div className="flex items-center">
                <span className="w-36 text-slate-600">Campaign Owner</span>
                <span className="flex items-center gap-1.5 font-medium text-slate-900">
                  : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-lime-500 text-white text-[10px] font-bold">SU</span>
                  {ownerName}
                  <ExternalLink className="h-3 w-3 text-slate-400 ml-0.5" />
                </span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Start Date</span>
                <span className="text-slate-900">: {campaign.start_date || '—'}</span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">End Date</span>
                <span className="text-slate-900">: {campaign.end_date || '—'}</span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Type</span>
                <span className="text-slate-900 capitalize">: {campaign.campaign_type?.replace(/_/g, ' ') || '—'}</span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Expected Revenue</span>
                <span className="text-slate-900 font-medium">
                  : {campaign.expected_revenue != null ? Number(campaign.expected_revenue).toFixed(2) : '—'}
                </span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Expected Response (%)</span>
                <span className="text-slate-900">: {campaign.expected_response != null ? `${campaign.expected_response}%` : '—'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <PermissionGate action="campaigns.update">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Campaign</span>
              </button>
            </PermissionGate>

            <PermissionGate action="campaigns.delete">
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg transition"
                title="Delete Campaign"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Chevron Pipeline Progression Bar matching Image 2 */}
        <div className="mt-5">
          <CampaignPipelineBar
            currentStatus={campaign.status}
            canUpdate={hasPermission('campaigns.update')}
            onStatusChange={async (s) => {
              await updateStatusMutation.mutateAsync(s);
            }}
          />
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 space-x-1 mb-6 bg-white px-2 rounded-t-lg shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'details'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'activity'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Activity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('related')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'related'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Related Lists</span>
          {opportunities.length > 0 && (
            <span className="h-2 w-2 rounded-full bg-[#4361ee]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'notes'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Notes &amp; Attachments</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>History</span>
        </button>
      </div>

      {/* Tab 1: Details */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>Last edited {campaign.updated_at ? new Date(campaign.updated_at).toLocaleString() : 'recently'} by {ownerName}</span>
            {hasPermission('campaigns.update') && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="rounded bg-[#e3e5f7] px-4 py-2 text-[#737bc5] font-medium hover:bg-[#d8dbf3] transition"
              >
                Edit Details
              </button>
            )}
          </div>

          {/* Section 1: Campaign Information */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Campaign Information
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Campaign Name</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{campaign.campaign_name}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Campaign Type</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block capitalize">
                  {campaign.campaign_type?.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Status</span>
                <span className="font-semibold text-[#4361ee] text-sm mt-0.5 block capitalize">
                  {campaign.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Parent Campaign</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {campaign.parent ? (
                    <Link href={`/campaigns/${campaign.parent.id}`} className="text-[#4361ee] hover:underline">
                      {campaign.parent.campaign_name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Planning & Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Planning &amp; Timeline
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Start Date</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{campaign.start_date || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">End Date</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{campaign.end_date || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Expected Response (%)</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {campaign.expected_response != null ? `${campaign.expected_response}%` : '—'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Numbers Sent</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {campaign.number_sent != null ? campaign.number_sent.toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Financial & Revenue */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Financial &amp; Revenue Details
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Expected Revenue</span>
                <span className="font-bold text-[#4361ee] text-sm mt-0.5 block">
                  ${expectedRevenue.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Budget Cost</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  ${budgetCost.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Actual Cost</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  ${actualCost.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Attained ROI</span>
                <span className={`font-bold text-sm mt-0.5 block ${roiPercent >= 0 ? 'text-[#4361ee]' : 'text-rose-600'}`}>
                  {roiPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Description */}
          {campaign.description && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Description
              </div>
              <div className="p-5 text-sm text-slate-700 whitespace-pre-wrap">
                {campaign.description}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Activity */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Campaign Activity &amp; Engagements</h3>
          <p className="text-sm text-slate-500 mb-4">
            Track outbound marketing emails, event attendee logs, telemarketing calls, and milestones for this campaign.
          </p>
          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-800 font-medium">
              <Calendar className="h-4 w-4 text-[#4361ee]" />
              <span>Campaign created on {new Date(campaign.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Related Lists */}
      {activeTab === 'related' && (
        <div className="space-y-6">
          {/* Members */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Campaign Members</h3>
            <CampaignMembers
              campaignId={campaignId}
            />
          </div>

          {/* Linked Opportunities */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Linked Opportunities ({opportunities.length})</h3>
            {opportunities.length === 0 ? (
              <p className="text-sm text-slate-500">No opportunities linked as primary campaign source.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <Link href={`/opportunities/${opp.id}`} className="font-medium text-[#4361ee] hover:underline">
                        {opp.name}
                      </Link>
                      <span className="text-xs text-slate-500 ml-2">({opp.stage})</span>
                    </div>
                    <span className="font-semibold text-slate-800">${Number(opp.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Notes & Attachments */}
      {activeTab === 'notes' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Notes &amp; Attachments</h3>
          <div className="flex gap-2">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note to this campaign..."
              className="flex-1 p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4361ee]"
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!noteContent.trim()) return;
                setNotesList((prev) => [
                  { id: String(Date.now()), content: noteContent, date: new Date().toLocaleString() },
                  ...prev,
                ]);
                setNoteContent('');
              }}
              className="px-4 py-2 bg-[#4361ee] hover:bg-[#4361ee] text-white text-xs font-semibold rounded-lg transition"
            >
              Add Note
            </button>
          </div>
          <div className="space-y-3 mt-4 divide-y divide-slate-100">
            {notesList.map((n) => (
              <div key={n.id} className="pt-3 text-xs">
                <p className="text-slate-800 text-sm">{n.content}</p>
                <span className="text-slate-400 mt-1 block">{n.date}</span>
              </div>
            ))}
            {notesList.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">No notes recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <RecordHistoryAudit module="campaigns" recordId={campaignId} />
        </div>
      )}

      {/* Edit Campaign Modal */}
      {isEditModalOpen && (
        <CampaignForm
          record={campaign as unknown as CampaignRecord}
          parents={[]}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={async () => {
            setIsEditModalOpen(false);
            await refetch();
          }}
        />
      )}
    </PageContainer>
  );
}
