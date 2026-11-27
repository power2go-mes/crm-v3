'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ContactEditModal } from '@/components/contacts/contact-edit-modal';
import { RecordActivityTimeline } from '@/components/activities/record-activity-timeline';
import { RecordHistoryAudit } from '@/components/history/record-history-audit';
import { RecordDuplicatesDrawer } from '@/components/duplicates/record-duplicates-drawer';
import {
  useContactDetail,
  useUpdateContactMutation,
  useDeleteContactMutation,
} from '@/hooks/use-contacts';
import Link from 'next/link';
import { ContactAccounts } from '@/components/contacts/contact-accounts';
import {
  ArrowLeft,
  Users,
  Building2,
  Edit2,
  Trash2,
  Mail,
  Phone,
  User,
  FileText,
  AlertCircle,
  ExternalLink,
  Activity,
  History,
  GitMerge,
  Send,
} from 'lucide-react';
import { EmailComposerModal } from '@/components/email/email-composer-modal';
import { EmailHistoryList } from '@/components/email/email-history-list';

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ContactDetailPage({ params }: ContactDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const contactId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<'details' | 'accounts' | 'activity' | 'emails' | 'history' | 'account_overview'>('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicatesDrawerOpen, setIsDuplicatesDrawerOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const { data: contact, isLoading, error } = useContactDetail(contactId);
  const updateMutation = useUpdateContactMutation();
  const deleteMutation = useDeleteContactMutation();

  const handleDelete = async () => {
    if (!contact) return;
    if (window.confirm('Are you sure you want to delete this contact?')) {
      await deleteMutation.mutateAsync(contact.id);
      router.push('/contacts');
    }
  };

  if (isLoading) {
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

  if (error || !contact) {
    return (
      <PageContainer>
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-4">
          <AlertCircle className="h-10 w-10 text-red-700 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Contact Not Found</h2>
          <p className="text-sm text-slate-600">The requested contact record does not exist or access is restricted.</p>
          <Link
            href="/contacts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Contacts</span>
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
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Contacts</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#4361ee]/10 text-[#4361ee] rounded-xl">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {contact.first_name} {contact.last_name}
                </h1>
                {contact.is_primary && (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Primary Contact
                  </span>
                )}
              </div>
              {contact.title && (
                <p className="text-sm text-[#4361ee] font-medium mt-0.5">{contact.title}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600">
                {contact.account && (
                  <Link
                    href={`/accounts/${contact.account.id}`}
                    className="flex items-center gap-1.5 text-slate-700 hover:text-[#4361ee] transition"
                  >
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>{contact.account.name}</span>
                  </Link>
                )}
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                    {contact.email}
                  </span>
                )}
                {contact.contact_number && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    {contact.contact_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3 py-2 bg-[#3a5bf0] hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 shadow-xs"
              title="Compose and log email to contact"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send Email</span>
            </button>

            <PermissionGate action="contacts.edit">
              <button
                type="button"
                onClick={() => setIsDuplicatesDrawerOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
                title="Scan for potential duplicate contacts"
              >
                <GitMerge className="h-3.5 w-3.5 text-[#4361ee]" />
                <span>Find Duplicates</span>
              </button>
            </PermissionGate>

            <PermissionGate action="contacts.edit">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Contact</span>
              </button>
            </PermissionGate>

            <PermissionGate action="contacts.delete">
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg transition"
                title="Delete Contact"
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
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'accounts'
                ? 'border-[#4361ee] text-[#4361ee]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Related Accounts</span>
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

          {contact.account && (
            <button
              type="button"
              onClick={() => setActiveTab('account_overview')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
                activeTab === 'account_overview'
                  ? 'border-[#4361ee] text-[#4361ee]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Primary Account Overview</span>
            </button>
          )}
        </div>

        {/* Tab 1: Details */}
        {activeTab === 'details' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Contact Information
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">First Name</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{contact.first_name}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Last Name</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{contact.last_name}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Job Title</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{contact.title || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Primary Account</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                  {contact.account ? contact.account.name : 'Individual'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Parent Contact</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                  {contact.parent_contact
                    ? [contact.parent_contact.first_name, contact.parent_contact.last_name].filter(Boolean).join(' ') || 'Contact unavailable'
                    : 'None (Top Level)'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Primary Contact</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                  {contact.is_primary ? 'Yes (Primary)' : 'No'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Email Address</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{contact.email || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Primary Phone</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{contact.contact_number || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Secondary Phone</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{contact.secondary_contact_number || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-500 uppercase tracking-wider text-[10px]">Contact Owner</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                  {contact.contact_owner ? `${contact.contact_owner.first_name} (${contact.contact_owner.email})` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Related Accounts (M:N via Codex ContactAccounts) */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <ContactAccounts id={contact.id} />
          </div>
        )}

        {/* Tab 3: Activity Timeline */}
        {activeTab === 'activity' && (
          <RecordActivityTimeline
            relatedToType="contact"
            relatedToId={contact.id}
            recordTitle={`${contact.first_name} ${contact.last_name}`}
          />
        )}

        {/* Tab: Emails */}
        {activeTab === 'emails' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Email Communications</h3>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(true)}
                className="px-3 py-1.5 bg-[#3a5bf0] hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Compose Email</span>
              </button>
            </div>
            <EmailHistoryList relatedToType="contact" relatedToId={contact.id} />
          </div>
        )}

        {/* Tab 4: History & Audit */}
        {activeTab === 'history' && (
          <RecordHistoryAudit module="contacts" recordId={contact.id} />
        )}

        {/* Tab 5: Account Overview */}
        {activeTab === 'account_overview' && contact.account && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-6 text-sm text-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{contact.account.name}</h3>
                <p className="text-xs text-slate-600">Primary organization account associated with this contact.</p>
              </div>
              <Link
                href={`/accounts/${contact.account.id}`}
                className="px-3.5 py-1.5 bg-[#3a5bf0] hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <span>View Full Account</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <ContactEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          contact={contact}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: contact.id, updates });
          }}
        />
      )}
      {/* Duplicates Drawer */}
      {isDuplicatesDrawerOpen && (
        <RecordDuplicatesDrawer
          isOpen={isDuplicatesDrawerOpen}
          onClose={() => setIsDuplicatesDrawerOpen(false)}
          entityType="contacts"
          currentRecord={contact}
          onMergeComplete={() => router.push('/contacts')}
        />
      )}
      {/* Email Composer Modal */}
      {isEmailModalOpen && (
        <EmailComposerModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          relatedToType="contact"
          relatedToId={contact.id}
          defaultRecipientEmail={contact.email || ''}
          defaultRecipientName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
          mergeData={{
            recipientName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
            recipientEmail: contact.email || '',
            accountName: contact.account?.name || '',
          }}
        />
      )}
    </PageContainer>
  );
}
