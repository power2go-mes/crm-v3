'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { History, Clock, ShieldCheck, Tag, Filter, User } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { loadAuditLog } from '@/lib/settings/audit-log';

interface AuditEvent {
  id: string;
  module: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  actor_id: string | null;
  occurred_at: string;
}

export function SystemAuditLogViewer() {
  const supabase = createClient();
  const [selectedModule, setSelectedModule] = useState('all');
  const [page, setPage] = useState(1);
  const { user, profile, permissions, isLoading: authLoading, hasPermission } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['crm', user?.id, 'system-audit-logs', [...permissions].sort().join('|'), selectedModule, page],
    enabled: !authLoading && !!user && !!profile?.is_active && hasPermission('settings.view'),
    queryFn: () => loadAuditLog(supabase, selectedModule, page),
  });
  const logs = (data?.rows ?? []) as AuditEvent[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">System Audit & Transaction Logs</h3>
            <p className="text-xs text-slate-500">
              Complete historical record of record creations, state modifications, and deletion transactions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={selectedModule}
            onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 capitalize focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Modules</option>
            <option value="leads">Leads</option>
            <option value="accounts">Accounts</option>
            <option value="contacts">Contacts</option>
            <option value="opportunities">Opportunities</option>
            <option value="campaigns">Campaigns</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading && (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading system audit trail...
          </div>
        )}

        {error && <p role="alert" className="p-4 text-sm text-red-600">{error.message} <button onClick={() => void refetch()}>Retry</button></p>}
        {!isLoading && !error && logs.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No audit events captured yet for the selected filter.
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {logs.map((log) => {
            const actionColor =
              log.action === 'create'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : log.action === 'delete'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200';

            return (
              <div
                key={log.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/80 transition text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${actionColor}`}
                  >
                    {log.action}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 capitalize">{log.module} Record</span>
                      <span className="font-mono text-[10px] text-slate-500">ID: {log.record_id}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Transaction ID: {log.id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{new Date(log.occurred_at).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <nav aria-label="Audit history pagination" className="flex items-center gap-4 text-sm"><button disabled={page === 1 || isLoading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {data?.count ?? 0} events</span><button disabled={isLoading || page * 50 >= (data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</button></nav>
    </div>
  );
}
