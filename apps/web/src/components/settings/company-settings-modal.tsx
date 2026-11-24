'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@finlonexa/database';
import { currencyChoices } from '@/lib/settings/currencies';

interface CompanySettingsModalProps {
  settings: {
    company_name?: string | null;
    legal_name?: string | null;
    domain?: string | null;
    support_email?: string | null;
    phone_number?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    currency?: string | null;
    time_zone?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export function CompanySettingsModal({
  settings,
  isOpen,
  onClose,
  userId,
}: CompanySettingsModalProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [companyName, setCompanyName] = useState(settings?.company_name ?? '');
  const [legalName, setLegalName] = useState(settings?.legal_name || '');
  const [domain, setDomain] = useState(settings?.domain || '');
  const [supportEmail, setSupportEmail] = useState(settings?.support_email || '');
  const [phoneNumber, setPhoneNumber] = useState(settings?.phone_number || '');
  const [address, setAddress] = useState(settings?.address || '');
  const [currency, setCurrency] = useState(settings?.currency ?? '');
  const [timeZone, setTimeZone] = useState(settings?.time_zone ?? '');
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (payload: Database['public']['Tables']['company_settings']['Update']) => {
      if (!settings) throw new Error('Load company settings before editing.');
      const { data, error } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', userId, 'company-settings'] });
      queryClient.invalidateQueries({ queryKey: ['crm', userId, 'currencies'] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err?.message || 'Failed to update company settings.');
    },
  });

  if (!isOpen) return null;
  if (!settings) return <p role="alert">Company settings are unavailable. Close and reload Settings before editing.</p>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    updateMutation.mutate({
      company_name: companyName.trim(),
      legal_name: legalName || null,
      domain: domain || null,
      support_email: supportEmail || null,
      phone_number: phoneNumber || null,
      address: address || null,
      currency: currency || null,
      time_zone: timeZone || null,
    });
  };

  const isPending = updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Edit Company Parameters
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Operational Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Select Currency</option>
                {currency && !currencyChoices.some(choice => choice.code === currency) && <option value={currency}>{currency}</option>}
                {currencyChoices.map(choice => <option key={choice.code} value={choice.code}>{choice.name} ({choice.code})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Time Zone
              </label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Select Time Zone</option>
                {timeZone && !['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata'].includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Asia/Kolkata">India (IST)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Legal Entity Name
              </label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="FINLONEXA Technologies Inc."
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Corporate Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="finlonexa.com"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Support Email
              </label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@finlonexa.com"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Primary Phone
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (800) 555-0199"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Headquarters Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="100 Financial Plaza, Suite 400"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !companyName.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
