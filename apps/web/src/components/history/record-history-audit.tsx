'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { History, User, Clock, ArrowRight, ShieldCheck, Tag } from 'lucide-react';

interface HistoryEvent {
  id: string;
  module: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  actor_id: string | null;
  occurred_at: string;
  changes?: Array<{
    field: string;
    label: string;
    old: any;
    new: any;
  }>;
}

interface RecordHistoryAuditProps {
  module: 'accounts' | 'contacts' | 'opportunities' | 'campaigns' | 'leads';
  recordId: string;
}

export function RecordHistoryAudit({ module, recordId }: RecordHistoryAuditProps) {
  const supabase = createClient();

  const { data: history = [], isLoading, error } = useQuery<HistoryEvent[]>({
    queryKey: ['record-history', module, recordId],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('crm_shared_history', {
        m: module,
        rid: recordId,
        lim: 50,
        off: 0,
      });

      if (rpcError) {
        console.warn('crm_shared_history error:', rpcError);
        return [];
      }

      return (data as any as HistoryEvent[]) || [];
    },
    enabled: Boolean(recordId),
  });

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-500 italic">None</span>;
    if (typeof val === 'boolean') return val ? 'True' : 'False';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Audit Trail & Modification Log
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Immutable System Audit Trail</span>
        </div>
      </div>

      {isLoading && (
        <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
          Loading audit trail records...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300">
          Audit trail could not be retrieved.
        </div>
      )}

      {!isLoading && !error && history.length === 0 && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
          <History className="h-8 w-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">No History Recorded</h4>
          <p className="text-xs text-slate-500">
            No tracked field updates or modifications have been captured for this record yet.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {history.map((item) => {
          const actionBadgeColor =
            item.action === 'create'
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
              : item.action === 'delete'
                ? 'bg-red-950/60 text-red-400 border-red-800'
                : 'bg-blue-950/60 text-blue-400 border-blue-800';

          return (
            <div
              key={item.id}
              className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${actionBadgeColor}`}
                  >
                    {item.action === 'create' ? 'Created' : item.action === 'delete' ? 'Deleted' : 'Updated'}
                  </span>
                  <span className="text-xs font-medium text-slate-300">
                    Record {item.action} operation
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>{new Date(item.occurred_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Field Changes */}
              {item.changes && item.changes.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Changed Fields
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {item.changes.map((ch, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-1.5 font-medium text-slate-300">
                          <Tag className="h-3.5 w-3.5 text-blue-400" />
                          <span>{ch.label || ch.field}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 line-through">
                            {formatValue(ch.old)}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800 font-semibold">
                            {formatValue(ch.new)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : item.action === 'create' ? (
                <p className="text-xs text-slate-400 italic">
                  Initial record creation.
                </p>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No registered field changes recorded in this transaction.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
