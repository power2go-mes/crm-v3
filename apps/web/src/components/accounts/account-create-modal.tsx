'use client';

import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { ACCOUNT_SOURCES, ACCOUNT_INDUSTRIES, type AccountInsert } from '@/types/accounts';
import { useAuth } from '@/components/providers/auth-provider';

interface AccountCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (account: AccountInsert) => Promise<void>;
}

export function AccountCreateModal({ isOpen, onClose, onSubmit }: AccountCreateModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState<AccountInsert>({
    name: '',
    account_source: 'website',
    industry: 'technology',
    annual_revenue: undefined,
    contact_number: '',
    website: '',
    no_of_employees: undefined,
    fax: '',
    billing_address: '',
    shipping_address: '',
    account_owner_id: user?.id || null,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Account Name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        account_owner_id: user?.id || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#4361ee]/10 text-[#4361ee] rounded-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create New Account</h3>
              <p className="text-xs text-slate-400">Add a client company or partner organization.</p>
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
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Account Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Corporation"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee] text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Account Source
              </label>
              <select
                value={formData.account_source || ''}
                onChange={(e) => setFormData({ ...formData, account_source: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              >
                {ACCOUNT_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Industry
              </label>
              <select
                value={formData.industry || ''}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              >
                {ACCOUNT_INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Annual Revenue ($)
              </label>
              <input
                type="number"
                min="0"
                value={formData.annual_revenue ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    annual_revenue: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="1000000"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Phone / Contact Number
              </label>
              <input
                type="tel"
                value={formData.contact_number || ''}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                placeholder="+1-555-0100"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Website
              </label>
              <input
                type="text"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://acme.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Number of Employees
              </label>
              <input
                type="number"
                min="0"
                value={formData.no_of_employees ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    no_of_employees: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="250"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Billing Address
              </label>
              <textarea
                rows={2}
                value={formData.billing_address || ''}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                placeholder="123 Corporate Way, City, State, Zip"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee] resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Shipping Address
              </label>
              <textarea
                rows={2}
                value={formData.shipping_address || ''}
                onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                placeholder="456 Logistics Blvd, City, State, Zip"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4361ee] resize-none"
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
              className="px-5 py-2 bg-[#4361ee] hover:bg-[#4361ee] text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
