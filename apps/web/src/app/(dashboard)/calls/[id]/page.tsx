'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useCall, useUpdateCallMutation, useDeleteCallMutation } from '@/hooks/use-calls';
import { CallEditModal } from '@/components/calls/call-edit-modal';
import { CALL_TYPES, CALL_STATUSES } from '@/types/calls';
import {
  ArrowLeft,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Calendar,
  User,
  Clock,
  Link2,
  FileText,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: call, isLoading, error } = useCall(id);
  const updateMutation = useUpdateCallMutation();
  const deleteMutation = useDeleteCallMutation();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleDelete = async () => {
    if (!call) return;
    if (window.confirm('Are you sure you want to delete this call record?')) {
      await deleteMutation.mutateAsync(call.id);
      router.push('/calls');
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-100" />
        </div>
      </PageContainer>
    );
  }

  if (error || !call) {
    return (
      <PageContainer>
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-100">Call Record Not Found</h2>
          <p className="text-xs text-slate-400 mt-1">
            The requested call log does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/calls"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#4361ee] hover:bg-[#4361ee] text-white rounded-lg text-xs font-semibold transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Calls
          </Link>
        </div>
      </PageContainer>
    );
  }

  const typeConfig =
    CALL_TYPES.find((t) => t.value === call.call_type) || CALL_TYPES[0];
  const statusConfig =
    CALL_STATUSES.find((s) => s.value === call.status) || CALL_STATUSES[0];

  const getRelatedLink = () => {
    if (!call.related_to_type || !call.related_to_id) return null;
    const type = call.related_to_type.toLowerCase();
    switch (type) {
      case 'lead':
        return `/leads/${call.related_to_id}`;
      case 'contact':
        return `/contacts/${call.related_to_id}`;
      case 'account':
        return `/accounts/${call.related_to_id}`;
      case 'opportunity':
        return `/opportunities/${call.related_to_id}`;
      default:
        return null;
    }
  };

  const relatedUrl = getRelatedLink();

  return (
    <PageContainer>
      <PermissionGate action="calls.view" showAccessDenied>
        <div className="space-y-6">
          {/* Top Bar with Navigation & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/calls"
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                title="Back to Calls List"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{call.subject}</h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${typeConfig.color}`}
                  >
                    {call.call_type === 'inbound' ? (
                      <PhoneIncoming className="h-3 w-3" />
                    ) : (
                      <PhoneOutgoing className="h-3 w-3" />
                    )}
                    {typeConfig.label}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Call Log Details</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4361ee] hover:bg-[#4361ee] text-white transition shadow-sm"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Record
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5" /> Call Date
                </span>
                <p className="mt-1 font-medium text-slate-200 text-sm">
                  {call.start_time ? (
                    new Date(call.start_time).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" /> Duration
                </span>
                <p className="mt-1 font-medium text-slate-200 text-sm">
                  {call.call_duration_minutes !== null ? `${call.call_duration_minutes} Minutes` : '—'}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <User className="h-3.5 w-3.5" /> Logged By
                </span>
                <p className="mt-1 font-medium text-slate-200 text-sm">
                  {call.assigned_to ? (
                    `${call.assigned_to.first_name} ${call.assigned_to.last_name}`
                  ) : (
                    <span className="text-slate-500">Unassigned</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Link2 className="h-3.5 w-3.5" /> Related Record
                </span>
                <div className="mt-1">
                  {call.related_to_type && call.related_to_id ? (
                    relatedUrl ? (
                      <Link
                        href={relatedUrl}
                        className="inline-flex items-center gap-1 text-[#4361ee] hover:text-[#4361ee] font-medium underline transition text-sm"
                      >
                        <span className="capitalize">{call.related_to_type}</span> ({call.related_to_id.slice(0, 8)}...)
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-slate-300 text-sm">
                        <span className="capitalize">{call.related_to_type}</span>: {call.related_to_id}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500 text-sm">None</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider mb-2">
                <FileText className="h-3.5 w-3.5" /> Notes & Discussion
              </span>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                {call.description || <span className="text-slate-500 italic">No notes logged.</span>}
              </div>
            </div>
          </div>
        </div>

        {isEditModalOpen && (
          <CallEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            call={call}
            onSubmit={async (updates) => {
              await updateMutation.mutateAsync({ id: call.id, updates });
              setIsEditModalOpen(false);
            }}
          />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
