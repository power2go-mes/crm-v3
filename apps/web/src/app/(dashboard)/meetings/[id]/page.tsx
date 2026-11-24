'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useMeeting, useUpdateMeetingMutation, useDeleteMeetingMutation } from '@/hooks/use-meetings';
import { MeetingEditModal } from '@/components/meetings/meeting-edit-modal';
import { MEETING_STATUSES } from '@/types/meetings';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  MapPin,
  Video,
  Link2,
  FileText,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: meeting, isLoading, error } = useMeeting(id);
  const updateMutation = useUpdateMeetingMutation();
  const deleteMutation = useDeleteMeetingMutation();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleStatusChange = async (nextStatus: string) => {
    if (!meeting) return;
    await updateMutation.mutateAsync({
      id: meeting.id,
      updates: { status: nextStatus },
    });
  };

  const handleDelete = async () => {
    if (!meeting) return;
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      await deleteMutation.mutateAsync(meeting.id);
      router.push('/meetings');
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-200" />
        </div>
      </PageContainer>
    );
  }

  if (error || !meeting) {
    return (
      <PageContainer>
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-100">Meeting Not Found</h2>
          <p className="text-xs text-slate-400 mt-1">
            The requested meeting does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Meetings
          </Link>
        </div>
      </PageContainer>
    );
  }

  const statusConfig =
    MEETING_STATUSES.find((s) => s.value === meeting.status) || MEETING_STATUSES[0];

  const getRelatedLink = () => {
    if (!meeting.related_to_type || !meeting.related_to_id) return null;
    const type = meeting.related_to_type.toLowerCase();
    switch (type) {
      case 'lead':
        return `/leads/${meeting.related_to_id}`;
      case 'contact':
        return `/contacts/${meeting.related_to_id}`;
      case 'account':
        return `/accounts/${meeting.related_to_id}`;
      case 'opportunity':
        return `/opportunities/${meeting.related_to_id}`;
      default:
        return null;
    }
  };

  const relatedUrl = getRelatedLink();

  return (
    <PageContainer>
      <PermissionGate action="meetings.view" showAccessDenied>
        <div className="space-y-6">
          {/* Top Bar with Navigation & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/meetings"
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                title="Back to Meetings List"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{meeting.subject}</h1>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                  {meeting.meeting_url && (
                    <a
                      href={meeting.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 border border-emerald-200/30 text-[11px] font-semibold transition"
                    >
                      <Video className="h-3 w-3" /> Join <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Meeting Schedule & Details</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-600 text-white transition shadow-sm"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Meeting
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Quick Status Control */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Meeting Status:
              </label>
              <select
                value={meeting.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs font-medium px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {MEETING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Attributes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5" /> Start Time
                </span>
                <p className="mt-1 font-medium text-slate-200 text-xs">
                  {meeting.start_time ? new Date(meeting.start_time).toLocaleString() : '—'}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" /> End Time
                </span>
                <p className="mt-1 font-medium text-slate-200 text-xs">
                  {meeting.end_time ? new Date(meeting.end_time).toLocaleString() : '—'}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <User className="h-3.5 w-3.5" /> Meeting Host
                </span>
                <p className="mt-1 font-medium text-slate-200 text-xs">
                  {meeting.assigned_to ? (
                    `${meeting.assigned_to.first_name} ${meeting.assigned_to.last_name}`
                  ) : (
                    <span className="text-slate-500">Unassigned</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <MapPin className="h-3.5 w-3.5" /> Location / Link
                </span>
                <p className="mt-1 font-medium text-slate-200 text-xs truncate">
                  {meeting.meeting_url ? (
                    <a
                      href={meeting.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline"
                    >
                      {meeting.meeting_url}
                    </a>
                  ) : (
                    meeting.location || 'In-Person'
                  )}
                </p>
              </div>

              <div className="lg:col-span-4">
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Link2 className="h-3.5 w-3.5" /> Related CRM Record
                </span>
                <div className="mt-1">
                  {meeting.related_to_type && meeting.related_to_id ? (
                    relatedUrl ? (
                      <Link
                        href={relatedUrl}
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-600 font-medium underline transition text-xs"
                      >
                        <span className="capitalize">{meeting.related_to_type}</span> ({meeting.related_to_id.slice(0, 8)}...)
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-slate-300 text-xs">
                        <span className="capitalize">{meeting.related_to_type}</span>: {meeting.related_to_id}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500 text-xs">None</span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider mb-2">
                <FileText className="h-3.5 w-3.5" /> Agenda & Discussion Notes
              </span>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                {meeting.description || <span className="text-slate-500 italic">No notes logged.</span>}
              </div>
            </div>
          </div>
        </div>

        {isEditModalOpen && (
          <MeetingEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            meeting={meeting}
            onSubmit={async (updates) => {
              await updateMutation.mutateAsync({ id: meeting.id, updates });
              setIsEditModalOpen(false);
            }}
          />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
