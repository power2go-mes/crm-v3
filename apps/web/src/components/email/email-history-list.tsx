'use client';

import React from 'react';
import { Mail, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useRecordEmails } from '@/hooks/use-email';
import type { CrmEmail } from '@/types/email';

interface EmailHistoryListProps {
  relatedToType: 'account' | 'contact' | 'opportunity' | 'lead';
  relatedToId: string;
}

export function EmailHistoryList({ relatedToType, relatedToId }: EmailHistoryListProps) {
  const { emails, isLoading } = useRecordEmails(relatedToType, relatedToId);

  if (isLoading) {
    return <p className="text-xs text-slate-500 py-3">Loading email history...</p>;
  }

  if (emails.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
        <Mail className="mx-auto mb-2 h-6 w-6 text-slate-400" />
        <p>No email communication logged for this record yet.</p>
      </div>
    );
  }

  const getStatusBadge = (status: CrmEmail['status']) => {
    switch (status) {
      case 'sent':
      case 'delivered':
      case 'provider_accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#4361ee] dark:bg-indigo-950/40 dark:text-indigo-200">
            <CheckCircle className="h-3 w-3" />
            {status === 'provider_accepted' ? 'Accepted by Provider' : 'Sent'}
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Clock className="h-3 w-3" />
            Draft
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" />
            Delivery Failed
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <RefreshCw className="h-3 w-3" />
            Queued
          </span>
        );
      default:
        return <span className="text-[10px] uppercase text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-3">
      {emails.map((email) => (
        <div
          key={email.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-900">{email.subject}</h4>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                To: <span className="font-medium text-slate-700 dark:text-slate-300">{email.recipient_email}</span>
                {email.recipient_name ? ` (${email.recipient_name})` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {getStatusBadge(email.status)}
              <span className="text-[10px] text-slate-400">
                {new Date(email.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700 line-clamp-2 dark:bg-slate-800/60 dark:text-slate-300">
            {email.body_html}
          </div>

          {email.error_message && (
            <p className="mt-2 text-[10px] text-red-600 dark:text-red-400">
              <strong>Error:</strong> {email.error_message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
