'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useAuth } from '@/components/providers/auth-provider';
import { useEmailAccounts, useEmailTemplates } from '@/hooks/use-email';
import {
  Mail,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Globe,
  Tag,
  Share2,
  Code,
  ShieldAlert,
} from 'lucide-react';
import { EMAIL_TEMPLATE_CATEGORIES, EMAIL_MERGE_FIELDS, type EmailTemplateCategory } from '@/types/email';

export default function EmailSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'accounts' | 'templates'>('accounts');

  // Accounts state
  const { accounts, saveAccount, deleteAccount, isSaving } = useEmailAccounts();
  const [connectProvider, setConnectProvider] = useState<'google' | 'microsoft' | 'smtp' | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountDisplayName, setAccountDisplayName] = useState('');

  // Templates state
  const { templates, saveTemplate, deleteTemplate, isSaving: isSavingTemplate } = useEmailTemplates();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateCategory, setTemplateCategory] = useState<EmailTemplateCategory>('general');
  const [templateBody, setTemplateBody] = useState('');
  const [templateIsShared, setTemplateIsShared] = useState(true);

  const handleOpenCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateSubject('');
    setTemplateCategory('general');
    setTemplateBody('');
    setTemplateIsShared(true);
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tpl: any) => {
    setEditingTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setTemplateSubject(tpl.subject);
    setTemplateCategory(tpl.category);
    setTemplateBody(tpl.body_html);
    setTemplateIsShared(tpl.is_shared);
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateSubject.trim()) return;

    await saveTemplate({
      id: editingTemplateId || undefined,
      name: templateName.trim(),
      subject: templateSubject.trim(),
      category: templateCategory,
      body_html: templateBody,
      is_shared: templateIsShared,
    });
    setIsTemplateModalOpen(false);
  };

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectProvider || !accountEmail.trim()) return;

    // External OAuth credentials check
    const isConfigured = false; // OAuth credentials not yet added in environment
    const authStatus = isConfigured ? 'connected' : 'unconfigured';
    const msg = isConfigured
      ? 'Connected and synchronized'
      : 'BLOCKED: Google/Microsoft OAuth Client ID & Secret not configured in environment.';

    await saveAccount({
      provider: connectProvider,
      email_address: accountEmail.trim(),
      display_name: accountDisplayName.trim() || null,
      auth_status: authStatus,
      status_message: msg,
    });

    setConnectProvider(null);
    setAccountEmail('');
    setAccountDisplayName('');
  };

  return (
    <PageContainer>
      <PageHeader
        title="Email Communication & Templates"
        subtitle="Configure connected email mailboxes, OAuth authorizations, and sales proposal email templates."
      />

      <PermissionGate action="email.manage" showAccessDenied>
        {/* Navigation Tabs */}
        <div className="mb-6 flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'accounts'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Connected Mailboxes</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Tag className="h-4 w-4" />
            <span>Email Templates ({templates.length})</span>
          </button>
        </div>

        {/* Tab 1: Connected Mailboxes */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            {/* OAuth Provider Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Google Workspace */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Workspace</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Gmail API
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Connect your business Gmail account for sending sales quotations and logging thread history.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setConnectProvider('google');
                      setAccountDisplayName('Google Workspace Mailbox');
                    }}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Connect Google Account
                  </button>
                </div>
              </div>

              {/* Microsoft 365 */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Microsoft 365</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    MS Graph
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Connect your corporate Outlook email account for outbound communication and calendar events.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setConnectProvider('microsoft');
                      setAccountDisplayName('Microsoft Outlook Mailbox');
                    }}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 dark:bg-slate-700"
                  >
                    Connect Microsoft Account
                  </button>
                </div>
              </div>

              {/* Custom SMTP */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Custom SMTP</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    SMTP / TLS
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Configure corporate relay SMTP credentials for high-volume automated transactional notifications.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setConnectProvider('smtp');
                      setAccountDisplayName('Corporate SMTP Relay');
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Configure SMTP Relay
                  </button>
                </div>
              </div>
            </div>

            {/* Connection Modal */}
            {connectProvider && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
                <h4 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                  Link {connectProvider.toUpperCase()} Mailbox
                </h4>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                  Enter your email address to register this account.
                </p>

                <form onSubmit={handleConnectAccount} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="user@finlonexa.test"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={accountDisplayName}
                      onChange={(e) => setAccountDisplayName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Save Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectProvider(null)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Configured Accounts Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Registered Mailbox Connections ({accounts.length})
                </h3>
              </div>

              {accounts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No mailboxes connected yet. Click any provider above to link an email account.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {acc.email_address}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {acc.provider.toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {acc.display_name || 'Personal Sales Mailbox'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            acc.auth_status === 'connected'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}
                        >
                          {acc.auth_status === 'connected' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {acc.auth_status === 'connected' ? 'Connected' : 'OAuth Config Required'}
                        </span>

                        <button
                          onClick={() => deleteAccount(acc.id)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Email Templates */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Standard templates enable rapid sales outreach with automatic merge field substitution.
              </p>
              <button
                onClick={handleOpenCreateTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>New Template</span>
              </button>
            </div>

            {/* Templates List */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {tpl.category}
                      </span>
                      {tpl.is_shared && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Share2 className="h-3 w-3" /> Shared
                        </span>
                      )}
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{tpl.name}</h4>
                    <p className="mt-1 text-xs text-slate-500 font-medium">Subject: {tpl.subject}</p>
                    <p className="mt-3 line-clamp-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {tpl.body_html}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      onClick={() => handleOpenEditTemplate(tpl)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(tpl.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Template Modal */}
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingTemplateId ? 'Edit Email Template' : 'Create Email Template'}
              </h3>

              <form onSubmit={handleSaveTemplate} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Initial Pricing Proposal"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Category</label>
                    <select
                      value={templateCategory}
                      onChange={(e) => setTemplateCategory(e.target.value as EmailTemplateCategory)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {EMAIL_TEMPLATE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    placeholder="Proposal for {{account.name}}"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Body HTML</label>
                    <span className="text-[10px] text-slate-400">Insert tags below:</span>
                  </div>
                  <div className="mb-2 mt-1 flex flex-wrap gap-1">
                    {EMAIL_MERGE_FIELDS.slice(0, 4).map((f) => (
                      <button
                        key={f.token}
                        type="button"
                        onClick={() => setTemplateBody((prev) => prev + ' ' + f.token)}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {f.token}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={6}
                    value={templateBody}
                    onChange={(e) => setTemplateBody(e.target.value)}
                    placeholder="Dear {{recipient.name}},&#10;&#10;Here is the quotation for {{account.name}}..."
                    className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="shared-check"
                    checked={templateIsShared}
                    onChange={(e) => setTemplateIsShared(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="shared-check" className="text-xs text-slate-700 dark:text-slate-300">
                    Share template with entire sales organization
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTemplate}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Save Template
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PermissionGate>
    </PageContainer>
  );
}
