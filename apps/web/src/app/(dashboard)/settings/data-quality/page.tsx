'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  useDuplicateRules,
  useMergeLogs,
  useFindDuplicateAccounts,
  useFindDuplicateContacts,
} from '@/hooks/use-duplicates';
import { useAccounts } from '@/hooks/use-accounts';
import { useContacts } from '@/hooks/use-contacts';
import { RecordMergeModal } from '@/components/duplicates/record-merge-modal';
import type { DuplicateCandidate } from '@/types/duplicates';
import {
  ShieldCheck,
  GitMerge,
  Search,
  AlertTriangle,
  History,
  Settings2,
  Users,
  Building2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

type DataQualityTab = 'accounts' | 'contacts' | 'logs' | 'rules';

export default function DataQualityPage() {
  const [activeTab, setActiveTab] = useState<DataQualityTab>('accounts');
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Selected records for merge modal
  const [mergeTarget, setMergeTarget] = useState<{
    type: 'accounts' | 'contacts';
    master: any;
    victim: any;
  } | null>(null);

  // Fetch accounts & contacts for scanning
  const { data: accountsData, refetch: refetchAccounts } = useAccounts({ pageSize: 100 });
  const { data: contactsData, refetch: refetchContacts } = useContacts({ pageSize: 100 });
  const { data: rules = [], isLoading: isLoadingRules } = useDuplicateRules();
  const { data: mergeLogs = [], isLoading: isLoadingLogs, refetch: refetchLogs } = useMergeLogs();

  const accounts = accountsData?.accounts || [];
  const contacts = contactsData?.contacts || [];

  // Client-side detection of duplicates across the loaded accounts
  const accountDuplicates = React.useMemo(() => {
    const list: { master: any; victim: any; score: number; reasons: string[] }[] = [];
    for (let i = 0; i < accounts.length; i++) {
      for (let j = i + 1; j < accounts.length; j++) {
        const a1 = accounts[i];
        const a2 = accounts[j];
        const reasons: string[] = [];
        let score = 0;

        if (a1.name && a2.name && a1.name.trim().toLowerCase() === a2.name.trim().toLowerCase()) {
          reasons.push('Exact Account Name Match');
          score = Math.max(score, 100);
        }

        const phone1 = a1.contact_number ? a1.contact_number.replace(/[^0-9]/g, '') : '';
        const phone2 = a2.contact_number ? a2.contact_number.replace(/[^0-9]/g, '') : '';
        if (phone1 && phone2 && phone1.length >= 7 && phone1 === phone2) {
          reasons.push('Identical Phone Number');
          score = Math.max(score, 90);
        }

        const normWeb1 = a1.website ? a1.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '';
        const normWeb2 = a2.website ? a2.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '';
        if (normWeb1 && normWeb2 && normWeb1.length >= 3 && normWeb1 === normWeb2) {
          reasons.push('Matching Web Domain');
          score = Math.max(score, 85);
        }

        if (reasons.length > 0) {
          list.push({ master: a1, victim: a2, score, reasons });
        }
      }
    }
    return list;
  }, [accounts]);

  // Client-side detection of duplicates across the loaded contacts
  const contactDuplicates = React.useMemo(() => {
    const list: { master: any; victim: any; score: number; reasons: string[] }[] = [];
    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const c1 = contacts[i];
        const c2 = contacts[j];
        const reasons: string[] = [];
        let score = 0;

        if (c1.email && c2.email && c1.email.trim().toLowerCase() === c2.email.trim().toLowerCase()) {
          reasons.push('Exact Email Address Match');
          score = Math.max(score, 100);
        }

        const phone1 = c1.contact_number ? c1.contact_number.replace(/[^0-9]/g, '') : '';
        const phone2 = c2.contact_number ? c2.contact_number.replace(/[^0-9]/g, '') : '';
        if (phone1 && phone2 && phone1.length >= 7 && phone1 === phone2) {
          reasons.push('Identical Contact Phone');
          score = Math.max(score, 90);
        }

        if (
          c1.first_name &&
          c2.first_name &&
          c1.last_name &&
          c2.last_name &&
          c1.first_name.trim().toLowerCase() === c2.first_name.trim().toLowerCase() &&
          c1.last_name.trim().toLowerCase() === c2.last_name.trim().toLowerCase()
        ) {
          reasons.push('Exact First & Last Name Match');
          score = Math.max(score, 80);
        }

        if (reasons.length > 0) {
          list.push({ master: c1, victim: c2, score, reasons });
        }
      }
    }
    return list;
  }, [contacts]);

  const handleScanNow = async () => {
    setIsScanning(true);
    await Promise.all([refetchAccounts(), refetchContacts(), refetchLogs()]);
    setTimeout(() => setIsScanning(false), 600);
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-2 text-xs">
        <Link href="/settings" className="text-slate-500 hover:text-blue-600 transition flex items-center gap-1">
          <span>Settings</span>
          <span>›</span>
          <span className="text-blue-600 font-medium">Data Quality &amp; Deduplication</span>
        </Link>
      </div>

      <PageHeader
        title="Data Quality & Deduplication"
        subtitle="Detect record conflicts across accounts and contacts, execute atomic record merges, and audit data hygiene."
        actions={
          <button
            onClick={handleScanNow}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Scan for Duplicates'}</span>
          </button>
        }
      />

      <PermissionGate action="settings.view" showAccessDenied>
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'accounts'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Account Duplicates ({accountDuplicates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'contacts'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Contact Duplicates ({contactDuplicates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Merge Audit Logs ({mergeLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>Deduplication Rules ({rules.length})</span>
          </button>
        </div>

        {/* Tab 1: Account Duplicates */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {accountDuplicates.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Zero Account Duplicates Detected
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All active accounts have passed matching rules for name, normalized phone numbers, and web domains.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {accountDuplicates.map((dup, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 dark:bg-slate-900 dark:border-slate-800"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {dup.score}% Confidence
                        </span>
                        {dup.reasons.map((r, rIdx) => (
                          <span
                            key={rIdx}
                            className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium"
                          >
                            {r}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/50">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate A</span>
                          <span className="font-semibold text-slate-900 dark:text-white text-sm block">
                            {dup.master.name}
                          </span>
                          <span className="text-slate-500 block">{dup.master.website || 'No website'}</span>
                          <span className="text-slate-500 block">{dup.master.contact_number || 'No phone'}</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/50">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate B</span>
                          <span className="font-semibold text-slate-900 dark:text-white text-sm block">
                            {dup.victim.name}
                          </span>
                          <span className="text-slate-500 block">{dup.victim.website || 'No website'}</span>
                          <span className="text-slate-500 block">{dup.victim.contact_number || 'No phone'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setMergeTarget({
                          type: 'accounts',
                          master: dup.master,
                          victim: dup.victim,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition shrink-0 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      <GitMerge className="h-4 w-4" />
                      <span>Review &amp; Merge</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Contact Duplicates */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {contactDuplicates.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Zero Contact Duplicates Detected
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All active contacts have passed matching rules for exact email addresses, phone numbers, and full names.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contactDuplicates.map((dup, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 dark:bg-slate-900 dark:border-slate-800"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {dup.score}% Confidence
                        </span>
                        {dup.reasons.map((r, rIdx) => (
                          <span
                            key={rIdx}
                            className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium"
                          >
                            {r}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/50">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate A</span>
                          <span className="font-semibold text-slate-900 dark:text-white text-sm block">
                            {dup.master.first_name} {dup.master.last_name}
                          </span>
                          <span className="text-slate-500 block">{dup.master.email || 'No email'}</span>
                          <span className="text-slate-500 block">{dup.master.contact_number || 'No phone'}</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/50">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate B</span>
                          <span className="font-semibold text-slate-900 dark:text-white text-sm block">
                            {dup.victim.first_name} {dup.victim.last_name}
                          </span>
                          <span className="text-slate-500 block">{dup.victim.email || 'No email'}</span>
                          <span className="text-slate-500 block">{dup.victim.contact_number || 'No phone'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setMergeTarget({
                          type: 'contacts',
                          master: dup.master,
                          victim: dup.victim,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition shrink-0 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      <GitMerge className="h-4 w-4" />
                      <span>Review &amp; Merge</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Merge Audit Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400">
              Historical Merge Audit Trail
            </div>

            {mergeLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No record merge events have been executed yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {mergeLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {log.entity_type}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Merged into Master ID: {log.master_id.slice(0, 8)}...
                        </span>
                      </div>
                      <span className="text-slate-400">
                        {new Date(log.merged_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-slate-600 dark:text-slate-400 pl-2 border-l-2 border-slate-200 dark:border-slate-700 text-[11px]">
                      {log.merge_details?.victim_name && (
                        <p>Archived record: <strong>{log.merge_details.victim_name}</strong></p>
                      )}
                      <p>
                        Repointed: {log.merge_details?.repointed_opportunities ?? 0} Opportunities,{' '}
                        {log.merge_details?.repointed_contacts ?? 0} Contacts,{' '}
                        {log.merge_details?.repointed_quotes ?? 0} Quotes,{' '}
                        {log.merge_details?.repointed_activities ?? 0} Activities
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Deduplication Rules */}
        {activeTab === 'rules' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400">
              Active Deduplication Matching Engine Rules
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {rules.map((rule) => (
                <div key={rule.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {rule.rule_name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {rule.entity_type}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      Match fields: <code className="font-mono text-slate-700 dark:text-slate-300">{rule.match_fields.join(', ')}</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Weight: {rule.threshold}%
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merge Modal */}
        {mergeTarget && (
          <RecordMergeModal
            isOpen={Boolean(mergeTarget)}
            entityType={mergeTarget.type}
            masterRecord={mergeTarget.master}
            victimRecord={mergeTarget.victim}
            onClose={() => setMergeTarget(null)}
            onMergeSuccess={handleScanNow}
          />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
