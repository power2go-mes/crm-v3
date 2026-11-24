'use client';

import React, { useState } from 'react';
import { X, UserPlus, Building2, GitFork, Star } from 'lucide-react';
import type { SaveContactInput } from '@/types/contacts';
import { useAccounts } from '@/hooks/use-accounts';
import { useContacts } from '@/hooks/use-contacts';
import { useAuth } from '@/components/providers/auth-provider';

interface ContactCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (contact: SaveContactInput) => Promise<void>;
  preselectedAccountId?: string;
}

export function ContactCreateModal({
  isOpen,
  onClose,
  onSubmit,
  preselectedAccountId,
}: ContactCreateModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: accountsData } = useAccounts({ pageSize: 100 });
  const accounts = accountsData?.accounts || [];

  const { data: contactsData } = useContacts({ pageSize: 100 });
  const existingContacts = contactsData?.contacts || [];

  const [formData, setFormData] = useState<SaveContactInput>({
    first_name: '',
    last_name: '',
    title: '',
    email: '',
    contact_number: '',
    secondary_contact_number: '',
    parent_contact_id: null,
    is_primary: false,
    relationships: preselectedAccountId ? [{ account_id: preselectedAccountId, role_id: null }] : [],
  });

  const selectedAccountId = formData.relationships?.[0]?.account_id || preselectedAccountId || '';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setErrorMsg('First Name and Last Name are required.');
      return;
    }

    if (!(formData.email ?? '').trim()) {
      setErrorMsg('Email address is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        ...formData,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: (formData.email ?? '').trim(),
        title: (formData.title || '').trim(),
        contact_number: (formData.contact_number || '').trim(),
        secondary_contact_number: (formData.secondary_contact_number || '').trim(),
        parent_contact_id: formData.parent_contact_id || null,
        is_primary: Boolean(formData.is_primary),
        relationships: selectedAccountId ? [{ account_id: selectedAccountId, role_id: null }] : [],
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create contact.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/10 text-emerald-600 rounded-lg">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create New Contact</h3>
              <p className="text-xs text-slate-400">Add an individual client or business contact.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Jane"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Last Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Doe"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Associated Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    relationships: val ? [{ account_id: val, role_id: null }] : [],
                  });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">No Account (Individual)</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Parent Contact (Hierarchy)
              </label>
              <select
                value={formData.parent_contact_id || ''}
                onChange={(e) => setFormData({ ...formData, parent_contact_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">None (Top-Level Contact)</option>
                {existingContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({c.title || 'No Title'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_primary)}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="rounded border-slate-700 bg-white text-emerald-800 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="font-semibold text-xs text-slate-300">Mark as Primary Contact</span>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="VP of Sales"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jane.doe@example.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Primary Phone
              </label>
              <input
                type="tel"
                value={formData.contact_number || ''}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                placeholder="+1-555-0101"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Secondary Phone
              </label>
              <input
                type="tel"
                value={formData.secondary_contact_number || ''}
                onChange={(e) =>
                  setFormData({ ...formData, secondary_contact_number: e.target.value })
                }
                placeholder="+1-555-0102"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
