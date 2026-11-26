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
  KeyRound,
  Server,
  ShieldCheck,
  Check,
  X,
  Send,
  RefreshCw,
} from 'lucide-react';
import { EMAIL_TEMPLATE_CATEGORIES, EMAIL_MERGE_FIELDS, type EmailTemplateCategory, type CrmEmailAccount } from '@/types/email';

export default function EmailSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'accounts' | 'templates'>('accounts');

  // Accounts state
  const { accounts, saveAccount, deleteAccount, isSaving } = useEmailAccounts();
  const [connectProvider, setConnectProvider] = useState<'google' | 'microsoft' | 'smtp' | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountDisplayName, setAccountDisplayName] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');

  // Test email modal state
  const [testModalAccount, setTestModalAccount] = useState<CrmEmailAccount | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [testPasswordInput, setTestPasswordInput] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Templates state
  const { templates, saveTemplate, deleteTemplate, isSaving: isSavingTemplate } = useEmailTemplates();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateCategory, setTemplateCategory] = useState<EmailTemplateCategory>('general');
  const [templateBody, setTemplateBody] = useState('');
  const [templateIsShared, setTemplateIsShared] = useState(true);

  const handleOpenConnect = (provider: 'google' | 'microsoft' | 'smtp') => {
    setEditingAccountId(null);
    setConnectProvider(provider);
    setAccountEmail('');
    setAccountDisplayName(provider === 'google' ? 'Google Workspace Mailbox' : provider === 'microsoft' ? 'Microsoft Outlook Mailbox' : 'Corporate SMTP Relay');
    setAppPassword('');
    setSmtpHost(provider === 'google' ? 'smtp.gmail.com' : provider === 'microsoft' ? 'smtp.office365.com' : 'smtp.company.com');
    setSmtpPort('587');
  };

  const handleOpenEditCredentials = (acc: CrmEmailAccount) => {
    setEditingAccountId(acc.id);
    setConnectProvider(acc.provider);
    setAccountEmail(acc.email_address);
    setAccountDisplayName(acc.display_name || '');
    setAppPassword(acc.encrypted_tokens?.app_password || '');
    setSmtpHost(acc.encrypted_tokens?.smtp_host || (acc.provider === 'google' ? 'smtp.gmail.com' : acc.provider === 'microsoft' ? 'smtp.office365.com' : 'smtp.company.com'));
    setSmtpPort(acc.encrypted_tokens?.smtp_port || '587');
  };

  const handleOpenTestModal = (acc: CrmEmailAccount) => {
    setTestModalAccount(acc);
    setTestRecipient(acc.email_address);
    // If the account already has a saved app password, preload it or leave blank to use the stored one
    setTestPasswordInput(acc.encrypted_tokens?.app_password || '');
    setTestResult(null);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectProvider || !accountEmail.trim()) return;

    const isConfigured = Boolean(appPassword.trim() || connectProvider === 'smtp');
    const authStatus = isConfigured ? 'connected' : 'unconfigured';
    const msg = isConfigured
      ? `Connected via ${connectProvider.toUpperCase()} Mail Protocol (Direct Credentials Active)`
      : 'Credentials pending configuration.';

    await saveAccount({
      ...(editingAccountId ? { id: editingAccountId } : {}),
      provider: connectProvider,
      email_address: accountEmail.trim(),
      display_name: accountDisplayName.trim() || null,
      auth_status: authStatus,
      status_message: msg,
      encrypted_tokens: {
        app_password: appPassword.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: smtpPort.trim(),
      },
    });

    setConnectProvider(null);
    setEditingAccountId(null);
    setAccountEmail('');
    setAccountDisplayName('');
    setAppPassword('');
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalAccount) return;

    // Use password from input if entered, otherwise fallback to stored encrypted_tokens
    const finalPassword = testPasswordInput.trim() || testModalAccount.encrypted_tokens?.app_password;
    if (!finalPassword) {
      setTestResult({ success: false, message: 'Please enter an App Password to test.' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_address: testModalAccount.email_address,
          app_password: finalPassword,
          provider: testModalAccount.provider,
          smtp_host: testModalAccount.encrypted_tokens?.smtp_host,
          smtp_port: testModalAccount.encrypted_tokens?.smtp_port,
          test_recipient: testRecipient.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, message: data.error || 'Failed to send test email.' });
      } else {
        setTestResult({ success: true, message: data.message || `Test email successfully sent to ${testRecipient}!` });
        // Update account status to connected
        await saveAccount({
          id: testModalAccount.id,
          provider: testModalAccount.provider,
          email_address: testModalAccount.email_address,
          auth_status: 'connected',
          status_message: 'Verified via live test email.',
          encrypted_tokens: {
            ...testModalAccount.encrypted_tokens,
            app_password: finalPassword,
          },
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Network error occurred while sending test email.' });
    } finally {
      setIsSendingTest(false);
    }
  };

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

  return (
    <PageContainer>
      <PageHeader
        title="Email Communication & Mailboxes"
        subtitle="Configure corporate Gmail/Google Workspace, Outlook, and Custom SMTP with email ID & app password."
      />

      <PermissionGate action="email.manage" showAccessDenied>
        {/* Navigation Tabs */}
        <div className="mb-6 flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'accounts'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Connected Mailboxes ({accounts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'templates'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="h-4 w-4" />
            <span>Email Templates ({templates.length})</span>
          </button>
        </div>

        {/* Tab 1: Connected Mailboxes */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            {/* Provider Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Google Workspace */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Google Workspace / Gmail</h3>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    App Password
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Connect your business Gmail account using Google App Password for direct quotation sending and thread logging.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => handleOpenConnect('google')}
                    className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Connect Google / Gmail
                  </button>
                </div>
              </div>

              {/* Microsoft 365 */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Microsoft 365 / Outlook</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                    SMTP / Exchange
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Connect your corporate Outlook email account with your email ID & app password for outbound communication.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => handleOpenConnect('microsoft')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                  >
                    Connect Outlook / 365
                  </button>
                </div>
              </div>

              {/* Custom SMTP */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Custom SMTP Relay</h3>
                  <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-200">
                    SMTP / TLS
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Configure corporate relay SMTP credentials and server ports for transactional delivery and automated notifications.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => handleOpenConnect('smtp')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                  >
                    Configure Custom SMTP
                  </button>
                </div>
              </div>
            </div>

            {/* Configured Accounts Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Registered Mailbox Connections ({accounts.length})
                </h3>
              </div>

              {accounts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No mailboxes connected yet. Click any provider above to link an email account.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 border border-emerald-200">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {acc.email_address}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {acc.provider.toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {acc.display_name || 'Personal Sales Mailbox'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                            acc.auth_status === 'connected'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}
                        >
                          {acc.auth_status === 'connected' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {acc.auth_status === 'connected' ? 'Active / Connected' : 'Credentials Required'}
                        </span>

                        {/* Send Test Email Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenTestModal(acc)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                          title="Send a real test email to verify credentials"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Send Test Email</span>
                        </button>

                        {/* Update Credentials Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditCredentials(acc)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition"
                          title="Update email address or app password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>Update Credentials</span>
                        </button>

                        <button
                          onClick={() => deleteAccount(acc.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          title="Delete mailbox connection"
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
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
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        {tpl.category}
                      </span>
                      {tpl.is_shared && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Share2 className="h-3 w-3" /> Shared
                        </span>
                      )}
                    </div>

                    <h4 className="mt-3 text-sm font-bold text-slate-900">{tpl.name}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500">{tpl.subject}</p>
                    <div className="mt-3 line-clamp-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">
                      {tpl.body_html.replace(/<[^>]*>?/gm, '')}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => handleOpenEditTemplate(tpl)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(tpl.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal for Connecting or Updating Mailbox with Email & App Password */}
        {connectProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingAccountId ? 'Update Mailbox Credentials' : `Connect ${connectProvider === 'google' ? 'Google Workspace / Gmail' : connectProvider === 'microsoft' ? 'Microsoft Outlook' : 'Corporate SMTP'}`}
                    </h3>
                    <p className="text-xs text-slate-500">Configure your direct email ID and app password</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConnectProvider(null);
                    setEditingAccountId(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    App Password / Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="e.g. 16-character Google App Password (abcd efgh ijkl mnop)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {connectProvider === 'google'
                      ? 'Generate via: Google Account → Security → 2-Step Verification → App passwords.'
                      : 'Use your account App Password or SMTP relay credential.'}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Account Display Label
                  </label>
                  <input
                    type="text"
                    value={accountDisplayName}
                    onChange={(e) => setAccountDisplayName(e.target.value)}
                    placeholder="e.g. Abdullah Rashid (Sales)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Port
                    </label>
                    <input
                      type="text"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectProvider(null);
                      setEditingAccountId(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs transition"
                  >
                    {isSaving ? 'Saving...' : editingAccountId ? 'Update Credentials' : 'Connect Mailbox'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Sending Real Test Email */}
        {testModalAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Send Test Email
                    </h3>
                    <p className="text-xs text-slate-500">Verify SMTP delivery & app password credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTestModalAccount(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSendTestEmail} className="mt-4 space-y-3.5 text-xs">
                {testResult && (
                  <div
                    className={`p-3 rounded-lg border flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <span className="text-xs font-medium leading-relaxed">{testResult.message}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Sending Mailbox (From)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={testModalAccount.email_address}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider">
                      App Password / Password
                    </label>
                    {testModalAccount.encrypted_tokens?.app_password && (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="h-3 w-3" /> Stored Credential Ready
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={testPasswordInput}
                    onChange={(e) => setTestPasswordInput(e.target.value)}
                    placeholder={testModalAccount.encrypted_tokens?.app_password ? "Using stored password (type to override)" : "Enter your App Password to test"}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {testModalAccount.encrypted_tokens?.app_password
                      ? 'Your saved password is automatically used. You only need to type here if you want to test a new password.'
                      : 'Enter your 16-character Google App Password or relay secret to test.'}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Recipient Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="e.g. yourpersonal@gmail.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    A verification email will be dispatched to this address.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTestModalAccount(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingTest}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    {isSendingTest ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Sending Test...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Dispatch Test Email</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Template Modal */}
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingTemplateId ? 'Edit Email Template' : 'Create Email Template'}
              </h3>

              <form onSubmit={handleSaveTemplate} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Initial Pricing Proposal"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Category</label>
                    <select
                      value={templateCategory}
                      onChange={(e) => setTemplateCategory(e.target.value as EmailTemplateCategory)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    placeholder="Proposal for {{account.name}}"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Template Content (HTML supported) *
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={templateBody}
                    onChange={(e) => setTemplateBody(e.target.value)}
                    placeholder="Hi {{contact.first_name}},\n\nThank you for speaking with us today..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={templateIsShared}
                      onChange={(e) => setTemplateIsShared(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Share template with entire sales organization
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(false)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTemplate}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
                    >
                      {isSavingTemplate ? 'Saving...' : 'Save Template'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </PermissionGate>
    </PageContainer>
  );
}
