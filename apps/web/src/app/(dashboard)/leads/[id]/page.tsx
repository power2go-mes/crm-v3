'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useAuth } from '@/components/providers/auth-provider';
import { LeadPipelineBar } from '@/components/leads/lead-pipeline-bar';
import { LeadDetailTabs } from '@/components/leads/lead-detail-tabs';
import { LeadEditModal } from '@/components/leads/lead-edit-modal';
import { LeadConvertModal } from '@/components/leads/lead-convert-modal';
import {
  useLeadDetail,
  useUpdateLeadMutation,
  useSaveLeadForm,
  useDeleteLeadMutation,
  useConvertLeadMutation,
} from '@/hooks/use-leads';
import Link from 'next/link';
import { useLeadNavigation } from '@/hooks/use-lead-navigation';
import { leadDeleteError } from '@/lib/leads/query-contract';
import { useRecordLeadVisit } from '@/hooks/use-lead-preferences';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit2,
  Shuffle,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const resolvedParams = use(params);
  const leadId = resolvedParams.id;
  const navigation = useLeadNavigation(user?.id, leadId);

  const { data: lead, isLoading: isLeadLoading, error } = useLeadDetail(leadId);

  const visit = useRecordLeadVisit(lead?.id ?? null);
  const updateMutation = useUpdateLeadMutation();
  const saveForm = useSaveLeadForm();
  const deleteMutation = useDeleteLeadMutation();
  const convertMutation = useConvertLeadMutation();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Status transition handler for pipeline bar
  const handleStageSelect = async (newStatus: string) => {
    if (!lead) return;
    await updateMutation.mutateAsync({
      id: lead.id,
      updates: { status: newStatus },
    });
  };

  // Delete lead handler
  const handleDelete = async () => {
    if (!lead) return;
    if (window.confirm('Move this Lead to Deleted Leads?')) {
      setDeleteError('');
      try {
        await deleteMutation.mutateAsync(lead.id);
        router.push('/leads');
      } catch (error) {
        setDeleteError(leadDeleteError(error));
      }
    }
  };

  if (isLeadLoading) {
    return (
      <PageContainer>
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-48" />
          <div className="h-24 bg-slate-800/60 rounded-xl" />
          <div className="h-16 bg-slate-800/40 rounded-xl" />
          <div className="h-96 bg-slate-800/40 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (error || !lead) {
    return (
      <PageContainer>
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Lead Not Found</h2>
          <p className="text-sm text-slate-400">
            The requested lead does not exist or you do not have permission to access it.
          </p>
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Leads Pipeline</span>
          </Link>
        </div>
      </PageContainer>
    );
  }

  const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Untitled Lead';

  return (
    <PageContainer maxWidth="full" className="min-h-full bg-[#f7f9fc]">
      {deleteError && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#4361ee] transition"
        >
          <span>Leads</span><span aria-hidden="true">›</span><span className="text-[#4361ee]">{leadName}</span>
        </Link>
      </div>

      {/* Main Record Header Card */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{lead.title || leadName}</h1>
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {([
              ['Previous', navigation.previous, ChevronLeft],
              ['Next', navigation.next, ChevronRight],
            ] as const).map(([label, href, Icon]) => href
              ? <Link key={label} href={href} aria-label={label} className="rounded-full bg-[#eef2ff] p-2 text-[#4361ee]"><Icon className="h-4 w-4" /></Link>
              : <button key={label} type="button" disabled aria-label={label} className="rounded-full bg-[#eef2ff] p-2 text-slate-400"><Icon className="h-4 w-4" /></button>
            )}
            {(hasPermission('leads.update') || hasPermission('leads.delete')) &&
              <details className="relative">
                <summary aria-label="Menu" className="cursor-pointer list-none rounded p-2 text-slate-600 hover:bg-slate-100">
                  <MoreVertical className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 z-20 flex min-w-40 flex-col rounded-lg border bg-white p-1 shadow-lg">
            <PermissionGate action="leads.update">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#eef2ff]"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Lead</span>
              </button>
            </PermissionGate>

            {!lead.is_convert && (
              <PermissionGate action="leads.update">
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#eef2ff]"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>Convert Lead</span>
                </button>
              </PermissionGate>
            )}

            <PermissionGate action="leads.delete">
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                title="Delete Lead"
              >
                <Trash2 className="h-4 w-4" /> Delete Lead
              </button>
            </PermissionGate>
                </div>
              </details>}
          </div>
        </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3 mt-6 text-base text-slate-800">
              <div>First Name <span className="ml-5">: {lead.first_name || '—'}</span></div>
              <div>Last Name <span className="ml-5">: {lead.last_name || '—'}</span></div>
              <div>Email <span className="ml-5">: {lead.email || '—'}</span></div>
              <div>Lead Source <span className="ml-5">: {lead.lead_source || '—'}</span></div>
              <div>Industry <span className="ml-5">: {lead.industry || '—'}</span></div>
              <div>Lead Owner <span className="ml-5">: {lead.lead_owner ? `${lead.lead_owner.first_name} ${lead.lead_owner.last_name}` : '—'}</span></div>
            </div>
      </div>
      <div className="mb-5">
        <LeadPipelineBar
          currentStatus={lead.status}
          isConverted={lead.is_convert}
          canUpdate={hasPermission('leads.update')}
          onStatusChange={handleStageSelect}
          onConvertClick={() => setIsConvertModalOpen(true)}
        />
      </div>

      {/* Tabs */}
      <LeadDetailTabs lead={lead} onEdit={() => setIsEditModalOpen(true)} />

      {/* Modals */}
      {isEditModalOpen && (
        <LeadEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          lead={lead}
          onSubmit={async (updates, custom) => {
            await saveForm.mutateAsync({ id: lead.id, standard: updates, custom: custom ?? {} });
            setIsEditModalOpen(false);
          }}
        />
      )}

      {isConvertModalOpen && (
        <LeadConvertModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          lead={lead}
          onConvert={async (payload) => {
            return await convertMutation.mutateAsync(payload);
          }}
        />
      )}
    </PageContainer>
  );
}
