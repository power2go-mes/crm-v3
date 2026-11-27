'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { OpportunityStageBadge } from '@/components/opportunities/opportunity-stage-badge';
import { OpportunityPipelineBar } from '@/components/opportunities/opportunity-pipeline-bar';
import { OpportunityEditModal } from '@/components/opportunities/opportunity-edit-modal';
import { ClosedLostModal } from '@/components/opportunities/closed-lost-modal';
import { OpportunityTeamCard } from '@/components/opportunities/opportunity-team-card';
import { OpportunityProductsTab } from '@/components/opportunities/opportunity-products-tab';
import { OpportunityQuotesTab } from '@/components/opportunities/opportunity-quotes-tab';
import { RecordActivityTimeline } from '@/components/activities/record-activity-timeline';
import { RecordHistoryAudit } from '@/components/history/record-history-audit';
import {
  useOpportunityDetail,
  useUpdateOpportunityMutation,
  useDeleteOpportunityMutation,
  useReopenOpportunityMutation,
  useOpportunityLossHistory,
} from '@/hooks/use-opportunities';
import { useContacts } from '@/hooks/use-contacts';
import { CLOSED_LOST_REASONS } from '@/types/opportunities';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  Building2,
  Calendar,
  DollarSign,
  User,
  Edit2,
  Trash2,
  FileText,
  AlertCircle,
  ExternalLink,
  Activity,
  History,
  Layers,
  Package,
  AlertTriangle,
  RotateCcw,
  Clock,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  Mail,
  Send,
} from 'lucide-react';
import { EmailComposerModal } from '@/components/email/email-composer-modal';
import { EmailHistoryList } from '@/components/email/email-history-list';

interface OpportunityDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'details' | 'products' | 'quotes' | 'activity' | 'emails' | 'related' | 'notes' | 'history';

export default function OpportunityDetailPage({ params }: OpportunityDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const oppId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isClosedLostModalOpen, setIsClosedLostModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [notesList, setNotesList] = useState<{ id: string; content: string; date: string }[]>([]);

  const { data: opp, isLoading, error } = useOpportunityDetail(oppId);
  const { data: lossHistory = [] } = useOpportunityLossHistory(oppId);
  const { data: contactsData } = useContacts({ accountId: opp?.account_id, pageSize: 1 });
  const primaryContact = contactsData?.contacts?.[0];
  const defaultEmail = primaryContact?.email || '';
  const defaultRecipientName = primaryContact ? `${primaryContact.first_name || ''} ${primaryContact.last_name || ''}`.trim() : (opp?.account?.name || '');
  const updateMutation = useUpdateOpportunityMutation();
  const deleteMutation = useDeleteOpportunityMutation();
  const reopenMutation = useReopenOpportunityMutation();

  const handleStageSelect = async (newStage: string) => {
    if (!opp) return;
    if (newStage === 'closed_lost') {
      setIsClosedLostModalOpen(true);
      return;
    }

    await updateMutation.mutateAsync({
      id: opp.id,
      updates: { stage: newStage } as any,
    });
  };

  const handleConfirmClosedLost = async (data: {
    lost_reason: string;
    competitor_name?: string;
    lost_reason_details?: string;
  }) => {
    if (!opp) return;
    await updateMutation.mutateAsync({
      id: opp.id,
      updates: {
        stage: 'closed_lost',
        lost_reason: data.lost_reason,
        competitor_name: data.competitor_name || null,
        lost_reason_details: data.lost_reason_details || null,
      } as any,
    });
  };

  const handleReopenDeal = async () => {
    if (!opp) return;
    const reason = window.prompt('Enter reason for reopening this deal (optional):', 'Client requested follow-up');
    if (reason === null) return; // User cancelled prompt

    try {
      setIsReopening(true);
      await reopenMutation.mutateAsync({
        id: opp.id,
        targetStage: 'prospecting',
        reason: reason.trim() || 'Reopened by sales representative',
      });
    } catch (err: any) {
      alert(err?.message || 'Failed to reopen opportunity.');
    } finally {
      setIsReopening(false);
    }
  };

  const handleDelete = async () => {
    if (!opp) return;
    if (window.confirm('Are you sure you want to delete this opportunity?')) {
      await deleteMutation.mutateAsync(opp.id);
      router.push('/opportunities');
    }
  };

  if (isLoading) {
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

  if (error || !opp) {
    return (
      <PageContainer maxWidth="full" className="min-h-full bg-[#f7f9fc]">
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Opportunity Not Found</h2>
          <p className="text-sm text-slate-500">The requested deal does not exist or access is restricted.</p>
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Opportunities</span>
          </Link>
        </div>
      </PageContainer>
    );
  }

  const expectedRevenue = Math.round(((opp.amount || 0) * (opp.probability || 0)) / 100);
  const ownerName = opp.owner
    ? `${opp.owner.first_name || ''} ${opp.owner.last_name || ''}`.trim()
    : 'Super Admin';

  const lostReasonLabel =
    CLOSED_LOST_REASONS.find((r) => r.id === opp.lost_reason)?.label || opp.lost_reason;

  return (
    <PageContainer maxWidth="full" className="min-h-full bg-[#f7f9fc]">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#4361ee] transition"
        >
          <span>Opportunities</span>
          <span aria-hidden="true">›</span>
          <span className="text-[#4361ee] font-medium">{opp.name}</span>
        </Link>
      </div>

      {/* Stalled Pipeline Hygiene Alert */}
      {opp.is_stalled && opp.stage !== 'closed_lost' && opp.stage !== 'closed_won' && (
        <div className="mb-4 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-amber-200/80 rounded-lg text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Pipeline Hygiene Alert — Stalled Deal
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                This opportunity has remained in stage <strong className="capitalize">{opp.stage?.replace(/_/g, ' ')}</strong> for{' '}
                <strong>{opp.days_in_stage ?? 14} days</strong> without stage advancement (threshold: 14 days). Follow up with the client or define the next milestone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition"
          >
            Update Next Step
          </button>
        </div>
      )}

      {/* Closed Lost Alert Banner */}
      {opp.stage === 'closed_lost' && (
        <div className="mb-4 p-5 rounded-xl border border-red-300 bg-red-50 text-red-950 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-red-200/80 rounded-xl text-red-700 shrink-0 mt-0.5">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-800">
                  Opportunity Closed Lost
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-200 text-red-800">
                  {lostReasonLabel || 'Loss Reason Unspecified'}
                </span>
                {opp.competitor_name && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-900 border border-red-200">
                    Competitor: {opp.competitor_name}
                  </span>
                )}
              </div>
              {opp.lost_reason_details && (
                <p className="text-xs text-red-800 italic">{opp.lost_reason_details}</p>
              )}
              <p className="text-[11px] text-red-600">
                Closed on {opp.closed_at ? new Date(opp.closed_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <PermissionGate action="opportunities.edit">
            <button
              type="button"
              disabled={isReopening}
              onClick={handleReopenDeal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4361ee] hover:bg-[#3a5bf0] text-white rounded-xl text-xs font-semibold shadow-xs transition shrink-0 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isReopening ? 'Reopening...' : 'Reopen Opportunity'}</span>
            </button>
          </PermissionGate>
        </div>
      )}

      {/* Main Record Header Card */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">{opp.name}</h1>
              <OpportunityStageBadge stage={opp.stage} />

              {/* Timing & Age Badges */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  Age: {opp.opportunity_age_days ?? 0}d
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#eef2ff] text-[#4361ee] font-medium">
                  In Stage: {opp.days_in_stage ?? 0}d
                </span>
              </div>
            </div>

            {/* Key Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3 mt-7 text-sm text-slate-800">
              <div className="flex items-center">
                <span className="w-36 text-slate-600">Opportunity Owner</span>
                <span className="flex items-center gap-1.5 font-medium text-slate-900">
                  : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-lime-500 text-white text-[10px] font-bold">SU</span>
                  {ownerName}
                  <ExternalLink className="h-3 w-3 text-slate-400 ml-0.5" />
                </span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Account</span>
                <span className="text-slate-900">
                  : {opp.account ? (
                    <Link href={`/accounts/${opp.account.id}`} className="text-[#4361ee] hover:underline">
                      {opp.account.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Stage</span>
                <span className="text-slate-900 font-medium capitalize">: {opp.stage?.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Amount</span>
                <span className="text-slate-900 font-semibold text-[#4361ee]">
                  : ${Number(opp.amount || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Probability</span>
                <span className="text-slate-900">: {opp.probability || 0}%</span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Expected Close</span>
                <span className="text-slate-900">: {opp.close_date || '—'}</span>
              </div>

              {/* Next Step & Next Activity Date */}
              <div>
                <span className="w-36 inline-block text-slate-600">Next Step</span>
                <span className="text-slate-900 font-medium">: {opp.next_step || '—'}</span>
              </div>
              <div>
                <span className="w-36 inline-block text-slate-600">Next Activity</span>
                <span className="text-slate-900">
                  : {opp.next_activity_date ? new Date(opp.next_activity_date).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3 py-2 bg-[#4361ee] hover:bg-[#4361ee] text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 shadow-xs"
              title="Compose and log sales email"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send Email</span>
            </button>

            <PermissionGate action="opportunities.edit">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Opportunity</span>
              </button>
            </PermissionGate>

            <PermissionGate action="opportunities.delete">
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg transition"
                title="Delete Opportunity"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Chevron Pipeline Progression Bar */}
        <div className="mt-5">
          <OpportunityPipelineBar
            currentStage={opp.stage}
            onSelectStage={handleStageSelect}
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
          onClick={() => setActiveTab('products')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'products'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Products</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quotes')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'quotes'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Quotations</span>
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
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'emails'
              ? 'border-indigo-100 text-[#4361ee]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Emails</span>
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
          <span>Opportunity Team</span>
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
          <FileText className="h-3.5 w-3.5" />
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
          <span>History &amp; Audits</span>
        </button>
      </div>

      {/* Tab 1: Details */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>Last edited {opp.updated_at ? new Date(opp.updated_at).toLocaleString() : 'recently'}</span>
            <PermissionGate action="opportunities.edit">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="rounded bg-[#e3e5f7] px-4 py-2 text-[#737bc5] font-medium hover:bg-[#d8dbf3] transition"
              >
                Edit Details
              </button>
            </PermissionGate>
          </div>

          {/* Section 1: Opportunity Information */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Opportunity Information &amp; Sales Process
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Opportunity Name</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{opp.name}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Account Name</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.account ? (
                    <Link href={`/accounts/${opp.account.id}`} className="text-[#4361ee] hover:underline">
                      {opp.account.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Next Step</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.next_step || '—'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Next Activity Date</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.next_activity_date ? new Date(opp.next_activity_date).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Lead Source</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.lead_source || '—'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Created Date</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.created_at ? new Date(opp.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Opportunity Age</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.opportunity_age_days ?? 0} days
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Days In Current Stage</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.days_in_stage ?? 0} days
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Revenue & Pipeline */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Financial &amp; Revenue Projection
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Deal Amount</span>
                <span className="font-bold text-[#4361ee] text-sm mt-0.5 block">
                  ${Number(opp.amount || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Probability</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.probability || 0}%
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Weighted Expected Value</span>
                <span className="font-bold text-[#4361ee] text-sm mt-0.5 block">
                  ${expectedRevenue.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Target Close Date</span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                  {opp.close_date || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Products & Line Items */}
      {activeTab === 'products' && (
        <OpportunityProductsTab
          opportunityId={opp.id}
          opportunityAmount={Number(opp.amount || 0)}
          priceSyncMode={(opp as any).price_sync_mode || 'manual'}
          priceBookId={(opp as any).price_book_id}
          currency={(opp as any).currency || 'INR'}
        />
      )}

      {/* Tab: Quotations & Proposals */}
      {activeTab === 'quotes' && (
        <OpportunityQuotesTab
          opportunity={{
            id: opp.id,
            name: opp.name,
            account_id: opp.account_id || opp.account?.id || null,
            account: opp.account,
            currency: (opp as any).currency || 'INR',
          }}
        />
      )}

      {/* Tab 2: Activity */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <RecordActivityTimeline relatedToType="opportunity" relatedToId={opp.id} recordTitle={opp.name} />
        </div>
      )}

      {/* Tab: Emails */}
      {activeTab === 'emails' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Email Communication History</h3>
              <p className="text-xs text-slate-500">Sales proposals, follow-ups, and negotiation messages sent for this deal.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#4361ee]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Compose Email</span>
            </button>
          </div>
          <EmailHistoryList relatedToType="opportunity" relatedToId={opp.id} />
        </div>
      )}

      {/* Tab 3: Related Lists */}
      {activeTab === 'related' && (
        <div className="space-y-6">
          <OpportunityTeamCard
            opportunityId={opp.id}
            dealName={opp.name}
            opportunityAmount={Number(opp.amount || 0)}
          />
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
              placeholder="Add a deal note or negotiation log..."
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

      {/* Tab 5: History & Loss Audits */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {lossHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-red-50/70 border-b border-red-200 text-xs font-semibold text-red-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span>Closed Lost &amp; Reopen Lifecycle History</span>
              </div>
              <div className="divide-y divide-slate-100">
                {lossHistory.map((item: any) => (
                  <div key={item.id} className="p-4 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        Reason: {CLOSED_LOST_REASONS.find((r) => r.id === item.lost_reason)?.label || item.lost_reason}
                      </span>
                      <span className="text-slate-400">
                        {new Date(item.closed_at).toLocaleString()}
                      </span>
                    </div>
                    {item.competitor_name && (
                      <p className="text-slate-600">
                        <strong>Competitor:</strong> {item.competitor_name}
                      </p>
                    )}
                    {item.lost_reason_details && (
                      <p className="text-slate-600 italic">{item.lost_reason_details}</p>
                    )}
                    {item.reopened_at && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[#4361ee] font-medium">
                        <span className="inline-flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />
                          Reopened: {item.reopen_reason || 'Reopened'}
                        </span>
                        <span className="text-slate-400 font-normal">
                          {new Date(item.reopened_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <RecordHistoryAudit module="opportunities" recordId={opp.id} />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <OpportunityEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          opportunity={opp}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: opp.id, updates });
            setIsEditModalOpen(false);
          }}
        />
      )}

      {/* Closed Lost Modal */}
      {isClosedLostModalOpen && (
        <ClosedLostModal
          isOpen={isClosedLostModalOpen}
          opportunityName={opp.name}
          onClose={() => setIsClosedLostModalOpen(false)}
          onConfirm={handleConfirmClosedLost}
        />
      )}

      {/* Email Composer Modal */}
      {isEmailModalOpen && (
        <EmailComposerModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          relatedToType="opportunity"
          relatedToId={opp.id}
          defaultRecipientEmail={defaultEmail}
          defaultRecipientName={defaultRecipientName}
          mergeData={{
            recipientName: defaultRecipientName || 'Valued Customer',
            recipientEmail: defaultEmail,
            accountName: opp.account?.name || '',
            opportunityName: opp.name,
            opportunityAmount: opp.amount ? `$${Number(opp.amount).toLocaleString()}` : '',
            opportunityStage: opp.stage,
          }}
        />
      )}
    </PageContainer>
  );
}
