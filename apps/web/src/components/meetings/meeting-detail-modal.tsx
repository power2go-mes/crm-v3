'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
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
import type { MeetingWithRelations } from '@/types/meetings';
import { MEETING_STATUSES } from '@/types/meetings';

interface MeetingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: MeetingWithRelations | null;
  onEdit: (meeting: MeetingWithRelations) => void;
  onDelete: (id: string) => Promise<void>;
  onStatusChange: (id: string, nextStatus: string) => Promise<void>;
}

export function MeetingDetailModal({
  isOpen,
  onClose,
  meeting,
  onEdit,
  onDelete,
  onStatusChange,
}: MeetingDetailModalProps) {
  if (!isOpen || !meeting) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusConfig.color}`}
            >
              {statusConfig.label}
            </span>
            {meeting.meeting_url && (
              <a
                href={meeting.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-600 text-white transition shadow-sm shadow-blue-500/20"
              >
                <Video className="h-3.5 w-3.5" /> Join Meeting <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(meeting);
              }}
              title="Edit Meeting"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this meeting?')) {
                  await onDelete(meeting.id);
                  onClose();
                }
              }}
              title="Delete Meeting"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{meeting.subject}</h2>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Status:
              </label>
              <select
                value={meeting.status}
                onChange={(e) => onStatusChange(meeting.id, e.target.value)}
                className="text-xs font-medium px-2.5 py-1 bg-white border border-slate-300 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {MEETING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
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
                <MapPin className="h-3.5 w-3.5" /> Location / Provider
              </span>
              <p className="mt-1 font-medium text-slate-200 text-xs">
                {meeting.location || <span className="text-slate-500">Not specified</span>}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <Link2 className="h-3.5 w-3.5" /> Related Record
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
                  <span className="text-slate-500 text-xs">None (Internal Meeting)</span>
                )}
              </div>
            </div>
          </div>

          {/* Agenda & Notes */}
          <div>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider mb-2">
              <FileText className="h-3.5 w-3.5" /> Agenda & Meeting Notes
            </span>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
              {meeting.description || <span className="text-slate-500 italic">No notes logged.</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
