'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
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
import type { CallWithRelations } from '@/types/calls';
import { CALL_TYPES, CALL_STATUSES } from '@/types/calls';

interface CallDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: CallWithRelations | null;
  onEdit: (call: CallWithRelations) => void;
  onDelete: (id: string) => Promise<void>;
}

export function CallDetailModal({
  isOpen,
  onClose,
  call,
  onEdit,
  onDelete,
}: CallDetailModalProps) {
  if (!isOpen || !call) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${typeConfig.color}`}
            >
              {call.call_type === 'inbound' ? (
                <PhoneIncoming className="h-3.5 w-3.5" />
              ) : (
                <PhoneOutgoing className="h-3.5 w-3.5" />
              )}
              {typeConfig.label}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${statusConfig.color}`}
            >
              {statusConfig.label}
            </span>
            {call.call_duration_minutes !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                {call.call_duration_minutes} min
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(call);
              }}
              title="Edit Call"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this call log?')) {
                  await onDelete(call.id);
                  onClose();
                }
              }}
              title="Delete Call"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
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
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{call.subject}</h2>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" /> Call Time
              </span>
              <p className="mt-1 font-medium text-slate-200">
                {call.start_time ? (
                  new Date(call.start_time).toLocaleString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                ) : (
                  <span className="text-slate-500">Unspecified</span>
                )}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <User className="h-3.5 w-3.5" /> Logged By / Caller
              </span>
              <p className="mt-1 font-medium text-slate-200">
                {call.assigned_to ? (
                  `${call.assigned_to.first_name} ${call.assigned_to.last_name} (${call.assigned_to.email})`
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
                      className="inline-flex items-center gap-1 text-[#4361ee] hover:text-[#4361ee] font-medium underline transition"
                    >
                      <span className="capitalize">{call.related_to_type}</span> ({call.related_to_id.slice(0, 8)}...)
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-slate-300">
                      <span className="capitalize">{call.related_to_type}</span>: {call.related_to_id}
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">None (General Call)</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" /> Logged On
              </span>
              <p className="mt-1 text-xs text-slate-300">
                {call.created_at ? new Date(call.created_at).toLocaleString() : '—'}
              </p>
            </div>
          </div>

          {/* Discussion Notes */}
          <div>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider mb-2">
              <FileText className="h-3.5 w-3.5" /> Call Discussion Notes
            </span>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
              {call.description || <span className="text-slate-500 italic">No notes logged for this call.</span>}
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
