'use client';

import React from 'react';
import { useLeadHistory } from '@/hooks/use-leads';
import { History, Clock, User } from 'lucide-react';

interface LeadHistoryAuditProps {
  leadId: string;
}

export function LeadHistoryAudit({ leadId }: LeadHistoryAuditProps) {
  const { data: history = [], isLoading } = useLeadHistory(leadId);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-12 bg-slate-800/60 rounded-xl" />
        <div className="h-12 bg-slate-800/60 rounded-xl" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
        No audit log entries recorded for this lead yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 text-blue-400" />
        <span>Field Modification Audit Log ({history.length})</span>
      </h4>

      <div className="overflow-hidden border border-slate-800 rounded-xl bg-slate-900/60">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Original Value</th>
              <th className="px-4 py-3">Updated Value</th>
              <th className="px-4 py-3">Actor ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/30 transition">
                <td className="px-4 py-3 whitespace-nowrap text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-200">
                  {item.field_name}
                </td>
                <td className="px-4 py-3 text-slate-400 truncate max-w-[150px]">
                  {item.old_value || '—'}
                </td>
                <td className="px-4 py-3 text-blue-300 font-medium truncate max-w-[150px]">
                  {item.new_value || '—'}
                </td>
                <td className="px-4 py-3 text-slate-400 truncate max-w-[150px]">
                  {item.actor_id || 'System'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
