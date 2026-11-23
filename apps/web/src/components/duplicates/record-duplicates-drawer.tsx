'use client';

import React, { useState } from 'react';
import { X, GitMerge, AlertTriangle, CheckCircle2, Search, ArrowRight } from 'lucide-react';
import {
  useFindDuplicateAccounts,
  useFindDuplicateContacts,
} from '@/hooks/use-duplicates';
import { RecordMergeModal } from './record-merge-modal';
import type { DuplicateCandidate } from '@/types/duplicates';

interface RecordDuplicatesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'accounts' | 'contacts';
  currentRecord: any;
  onMergeComplete?: () => void;
}

export function RecordDuplicatesDrawer({
  isOpen,
  onClose,
  entityType,
  currentRecord,
  onMergeComplete,
}: RecordDuplicatesDrawerProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  const accountQuery = useFindDuplicateAccounts({
    name: currentRecord?.name,
    phone: currentRecord?.contact_number,
    website: currentRecord?.website,
    excludeId: currentRecord?.id,
    enabled: isOpen && entityType === 'accounts',
  });

  const contactQuery = useFindDuplicateContacts({
    email: currentRecord?.email,
    phone: currentRecord?.contact_number,
    firstName: currentRecord?.first_name,
    lastName: currentRecord?.last_name,
    excludeId: currentRecord?.id,
    enabled: isOpen && entityType === 'contacts',
  });

  if (!isOpen) return null;

  const isLoading = entityType === 'accounts' ? accountQuery.isLoading : contactQuery.isLoading;
  const candidates: DuplicateCandidate[] =
    (entityType === 'accounts' ? accountQuery.data : contactQuery.data) || [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex justify-end">
        <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl dark:bg-blue-900/40 dark:text-blue-400">
                <GitMerge className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Duplicate Search
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-[240px]">
                  {currentRecord?.name || `${currentRecord?.first_name || ''} ${currentRecord?.last_name || ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {isLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Scanning matching rules against database...</p>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                  No Potential Duplicates Found
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  No other records matched the active deduplication rules (Name, Phone, Email, Domain).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Found {candidates.length} potential duplicate record{candidates.length > 1 ? 's' : ''}.
                  </span>
                </div>

                {candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 dark:bg-slate-800/60 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">
                        {cand.name || `${cand.first_name || ''} ${cand.last_name || ''}`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        {cand.confidence_score}% Match
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {cand.match_reasons.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 rounded text-[10px] bg-white border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                        >
                          {r}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                      {cand.website && <p>Website: {cand.website}</p>}
                      {cand.contact_number && <p>Phone: {cand.contact_number}</p>}
                      {cand.email && <p>Email: {cand.email}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCandidate(cand)}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                    >
                      <GitMerge className="h-3.5 w-3.5" />
                      <span>Review &amp; Merge</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedCandidate && (
        <RecordMergeModal
          isOpen={Boolean(selectedCandidate)}
          entityType={entityType}
          masterRecord={currentRecord}
          victimRecord={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onMergeSuccess={() => {
            setSelectedCandidate(null);
            onClose();
            onMergeComplete?.();
          }}
        />
      )}
    </>
  );
}
