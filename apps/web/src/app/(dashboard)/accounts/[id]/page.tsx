'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { AccountEditModal } from '@/components/accounts/account-edit-modal';
import { RecordActivityTimeline } from '@/components/activities/record-activity-timeline';
import { RecordHistoryAudit } from '@/components/history/record-history-audit';
import { RecordDuplicatesDrawer } from '@/components/duplicates/record-duplicates-drawer';
import {
  useAccountDetail,
  useAccountContacts,
  useAccountOpportunities,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
} from '@/hooks/use-accounts';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Edit2,
  Trash2,
  Phone,
  Globe,
  DollarSign,
  User,
  Users,
  TrendingUp,
  FileText,
  AlertCircle,
  ExternalLink,
  Activity,
  History,
  GitMerge,
  Send,
  Mail,
} from 'lucide-react';
import { EmailComposerModal } from '@/components/email/email-composer-modal';
import { EmailHistoryList } from '@/components/email/email-history-list';

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AccountDetailPage({ params }: AccountDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const accountId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'opportunities' | 'activity' | 'emails' | 'history'>('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicatesDrawerOpen, setIsDuplicatesDrawerOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const { data: account, isLoading: isAccountLoading, error } = useAccountDetail(accountId);
  const { data: contacts = [], isLoading: isContactsLoading } = useAccountContacts(accountId);
  const { data: opportunities = [], isLoading: isOppsLoading } = useAccountOpportunities(accountId);

  const updateMutation = useUpdateAccountMutation();
  const deleteMutation = useDeleteAccountMutation();

  const handleDelete = async () => {
    if (!account) return;
    if (window.confirm('Are you sure you want to delete this account?')) {
      await deleteMutation.mutateAsync(account.id);
      router.push('/accounts');
    }
  };

  if (isAccountLoading) {
    return (
      <PageContainer>
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-48" />
          <div className="h-28 bg-slate-800/60 rounded-xl" />
          <div className="h-96 bg-slate-800/40 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (error || !account) {
    return (
      <PageContainer>
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-4">
          <AlertCircle className="h-10 w-10 text-red-700 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Account Not Found</h2>
          <p className="text-sm text-slate-600">The requested account record does not exist or access is restricted.</p>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Accounts</span>
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Back button */}
      <div className="mb-4">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Accounts</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#4361ee]/10 text-[#4361ee] rounded-xl">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{account.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600">
                {account.industry && (
                  <span className="capitalize text-slate-700 font-medium">{account.industry}</span>
                )}
                {account.annual_revenue && (
                  <span className="text-[#4361ee] font-semibold flex items-center gap-0.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    ${Number(account.annual_revenue).toLocaleString()}
                  </span>
                )}
                {account.contact_number && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    {account.contact_number}
                  </span>
                )}
                {account.website && (
                  <a
                    href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#4361ee] hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>{account.website}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3 py-2 bg-[#3a5bf0] hover:bg-[#3a5bf0] text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 shadow-xs"
              title="Compose email to account contacts"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send Email</span>
            </button>

            <PermissionGate action="accounts.edit">
              <button
                type="button"
                onClick={() => setIsDuplicatesDrawerOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
                title="Scan for potential duplicate accounts"
              >
                <GitMerge className="h-3.5 w-3.5 text-[#4361ee]" />
                <span>Find Duplicates</span>
              </button>
            </PermissionGate>

            <PermissionGate action="accounts.edit">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Account</span>
              </button>
            </PermissionGate>

            <PermissionGate action="accounts.delete">
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg transition"
                title="Delete Account"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="flex border-b border-slate-200 space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'details'
                ? 'border-[#4361ee] text-[#4361ee]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'contacts'
                ? 'border-[#4361ee] text-[#4361ee]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Contacts ({contacts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('opportunities')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'opportunities'
                ? 'border-[#4361ee] text-[#4361ee]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Opportunities ({opportunities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'border-[#4361ee] text-[#4361ee]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Activity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'emails'
                ? 'border-[#4361ee] text-[#4361ee]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Emails</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-[#4361ee] text-[#4361ee]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>History & Audit</span>
          </button>
        </div>

        {/* Tab 1: Details */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Account Information
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Account Name</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{account.name}</span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Account Owner</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                    {account.account_owner ? `${account.account_owner.first_name} (${account.account_owner.email})` : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Source</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block capitalize">{account.account_source || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Industry</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block capitalize">{account.industry || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Annual Revenue</span>
                  <span className="font-bold text-[#4361ee] text-sm mt-0.5 block">
                    {account.annual_revenue ? `$${Number(account.annual_revenue).toLocaleString()}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">No of Employees</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{account.no_of_employees ?? '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Contact Number</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{account.contact_number || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Fax</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{account.fax || '—'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Address Information
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1">Billing Address</span>
                  <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-sm whitespace-pre-line">
                    {account.billing_address || 'No billing address recorded.'}
                  </p>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase tracking-wider text-[10px] mb-1">Shipping Address</span>
                  <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-sm whitespace-pre-line">
                    {account.shipping_address || 'No shipping address recorded.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Contacts */}
        {activeTab === 'contacts' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
                Associated Contacts ({contacts.length})
              </h3>
              <Link
                href="/contacts"
                className="px-3 py-1.5 bg-[#3a5bf0] hover:bg-[#3a5bf0] text-white rounded-lg text-xs font-medium transition"
              >
                Go to Contacts
              </Link>
            </div>

            {contacts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No contacts associated with this account yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {contacts.map((c: any) => (
                  <div key={c.id} className="py-3 flex items-center justify-between">
                    <div>
                      <Link href={`/contacts/${c.id}`} className="font-semibold text-sm text-slate-800 hover:text-[#4361ee] transition">
                        {c.first_name} {c.last_name}
                      </Link>
                      <div className="text-xs text-slate-600 mt-0.5">{c.title || 'Contact'} • {c.email || c.contact_number || 'No contact info'}</div>
                    </div>
                    <Link href={`/contacts/${c.id}`} className="text-xs text-[#4361ee] hover:underline">
                      View Contact →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Opportunities */}
        {activeTab === 'opportunities' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
                Associated Opportunities ({opportunities.length})
              </h3>
              <Link
                href="/opportunities"
                className="px-3 py-1.5 bg-[#3a5bf0] hover:bg-[#3a5bf0] text-white rounded-lg text-xs font-medium transition"
              >
                Go to Opportunities
              </Link>
            </div>

            {opportunities.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No opportunities associated with this account yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {opportunities.map((opp: any) => (
                  <div key={opp.id} className="py-3 flex items-center justify-between">
                    <div>
                      <Link href={`/opportunities/${opp.id}`} className="font-semibold text-sm text-slate-800 hover:text-[#4361ee] transition">
                        {opp.name}
                      </Link>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Stage: <span className="capitalize text-[#4361ee] font-medium">{opp.stage}</span> • Close Date: {opp.close_date}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#4361ee] text-sm block">
                        ${Number(opp.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Activity Timeline */}
        {activeTab === 'activity' && (
          <RecordActivityTimeline
            relatedToType="account"
            relatedToId={account.id}
            recordTitle={account.name}
          />
        )}

        {/* Tab: Emails */}
        {activeTab === 'emails' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Email Communications</h3>
                <p className="text-xs text-slate-600">All outbound emails and logged correspondence with {account.name}.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(true)}
                className="px-3.5 py-1.5 bg-[#3a5bf0] hover:bg-[#3a5bf0] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Compose Email</span>
              </button>
            </div>
            <EmailHistoryList relatedToType="account" relatedToId={account.id} />
          </div>
        )}

        {/* Tab 5: History & Audit */}
        {activeTab === 'history' && (
          <RecordHistoryAudit module="accounts" recordId={account.id} />
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <AccountEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          account={account}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: account.id, updates });
          }}
        />
      )}
      {/* Duplicates Drawer */}
      {isDuplicatesDrawerOpen && (
        <RecordDuplicatesDrawer
          isOpen={isDuplicatesDrawerOpen}
          onClose={() => setIsDuplicatesDrawerOpen(false)}
          entityType="accounts"
          currentRecord={account}
          onMergeComplete={() => router.push('/accounts')}
        />
      )}
      {/* Email Composer Modal */}
      {isEmailModalOpen && (
        <EmailComposerModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          relatedToType="account"
          relatedToId={account.id}
          mergeData={{
            recipientName: account.name,
            accountName: account.name,
          }}
        />
      )}
    </PageContainer>
  );
}
