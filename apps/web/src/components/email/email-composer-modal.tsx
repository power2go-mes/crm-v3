'use client';

import React, { useState } from 'react';
import { X, Send, FileText, AlertCircle, CheckCircle2, Paperclip, ChevronDown } from 'lucide-react';
import { useEmailAccounts, useEmailTemplates, useRecordEmails } from '@/hooks/use-email';
import { EMAIL_MERGE_FIELDS } from '@/types/email';
import { ModalPortal } from '@/components/ui/modal-portal';

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  relatedToType: 'account' | 'contact' | 'opportunity' | 'lead';
  relatedToId: string;
  defaultRecipientEmail?: string;
  defaultRecipientName?: string;
  mergeData?: {
    recipientName?: string;
    recipientEmail?: string;
    accountName?: string;
    opportunityName?: string;
    opportunityAmount?: string;
    opportunityStage?: string;
  };
}

export function EmailComposerModal({
  isOpen,
  onClose,
  relatedToType,
  relatedToId,
  defaultRecipientEmail = '',
  defaultRecipientName = '',
  mergeData = {},
}: EmailComposerModalProps) {
  const { accounts } = useEmailAccounts();
  const { templates } = useEmailTemplates();
  const { sendEmail, isSending } = useRecordEmails(relatedToType, relatedToId);

  const [toEmail, setToEmail] = useState(defaultRecipientEmail);
  const [toName, setToName] = useState(defaultRecipientName);
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  React.useEffect(() => {
    if (defaultRecipientEmail) {
      setToEmail(defaultRecipientEmail);
    }
    if (defaultRecipientName) {
      setToName(defaultRecipientName);
    }
  }, [defaultRecipientEmail, defaultRecipientName, isOpen]);

  if (!isOpen) return null;

  const connectedAccount = accounts.find((a) => a.auth_status === 'connected');

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    let sub = tpl.subject;
    let b = tpl.body_html;

    const replacements: Record<string, string> = {
      '{{recipient.name}}': mergeData.recipientName || toName || 'Valued Customer',
      '{{recipient.email}}': mergeData.recipientEmail || toEmail || '',
      '{{account.name}}': mergeData.accountName || 'your organization',
      '{{opportunity.name}}': mergeData.opportunityName || 'Proposal',
      '{{opportunity.amount}}': mergeData.opportunityAmount || '',
      '{{opportunity.stage}}': mergeData.opportunityStage || '',
    };

    for (const [token, val] of Object.entries(replacements)) {
      sub = sub.replaceAll(token, val);
      b = b.replaceAll(token, val);
    }

    setSubject(sub);
    setBody(b);
  };

  const handleSubmit = async (isDraft: boolean) => {
    setStatusMessage(null);
    if (!toEmail.trim()) {
      setStatusMessage({ type: 'error', text: 'Recipient email address is required.' });
      return;
    }
    if (!subject.trim()) {
      setStatusMessage({ type: 'error', text: 'Email subject is required.' });
      return;
    }

    try {
      const ccList = ccEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      const bccList = bccEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await sendEmail({
        recipient_email: toEmail.trim(),
        recipient_name: toName.trim() || undefined,
        cc_emails: ccList,
        bcc_emails: bccList,
        subject: subject.trim(),
        body_html: body,
        template_id: selectedTemplateId || null,
        is_draft: isDraft,
      });

      if (isDraft) {
        setStatusMessage({ type: 'success', text: 'Email draft saved successfully.' });
        setTimeout(() => onClose(), 1000);
      } else if (res.status === 'failed') {
        setStatusMessage({
          type: 'error',
          text: res.error_message || 'Email delivery blocked: Provider OAuth configuration required.',
        });
      } else {
        setStatusMessage({ type: 'success', text: 'Email queued and accepted by provider.' });
        setTimeout(() => onClose(), 1200);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to process email' });
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
        <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#4361ee]" />
            <h2 className="text-base font-bold text-slate-900">Compose Sales Email</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 flex items-center gap-2 rounded-lg p-3 text-xs font-medium ${
              statusMessage.type === 'error'
                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                : 'bg-[#eef2ff] text-[#4361ee] dark:bg-emerald-950/40 dark:text-[#4361ee]'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Provider Warning Banner */}
        {!connectedAccount && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Notice:</strong> No connected email account found. You can compose and save drafts. Actual delivery requires connecting Google Workspace or Microsoft 365 in Settings &rarr; Email.
          </div>
        )}

        {/* Body Fields */}
        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {/* Template Selector */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Load Template (Optional)
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">-- Choose an email template --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.category}] {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">To Email *</label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Recipient Name</label>
              <input
                type="text"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="Arthur Dent"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* CC & BCC */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">CC (Comma-separated)</label>
              <input
                type="text"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="sales-lead@mycompany.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">BCC</label>
              <input
                type="text"
                value={bccEmails}
                onChange={(e) => setBccEmails(e.target.value)}
                placeholder="crm-archive@mycompany.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Regarding your inquiry..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Body */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Message Body *</label>
              <span className="text-[10px] text-slate-400">Supports merge tags like {`{{recipient.name}}`}</span>
            </div>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Dear Arthur,&#10;&#10;Thank you for reaching out..."
              className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            disabled={isSending}
            onClick={() => handleSubmit(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Save as Draft
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#4361ee] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSending ? 'Sending...' : 'Send Email'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
);
}
