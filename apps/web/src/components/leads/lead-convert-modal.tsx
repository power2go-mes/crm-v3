'use client';

import React, { useState } from 'react';
import { X, Check, Building2, User, TrendingUp, ShieldCheck } from 'lucide-react';
import type { LeadWithRelations, LeadConversionPayload } from '@/types/leads';
import { useAuth } from '@/components/providers/auth-provider';
import { useLeadConversionOptions } from '@/hooks/use-lead-conversion-options';

interface LeadConvertModalProps {
  isOpen: boolean;
  lead: LeadWithRelations;
  onClose: () => void;
  onConvert: (payload: LeadConversionPayload) => Promise<any>;
  existingAccounts?: { id: string; name: string }[];
  existingContacts?: { id: string; first_name: string; last_name: string; email: string }[];
}

export function LeadConvertModal({
  isOpen,
  lead,
  onClose,
  onConvert,
  existingAccounts: providedAccounts,
  existingContacts: providedContacts,
}: LeadConvertModalProps) {
  const { user } = useAuth();
  const [recordSearch, setRecordSearch] = useState('');
  const [accountAction, setAccountAction] = useState<'create_new' | 'select_existing'>('create_new');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const options = useLeadConversionOptions(isOpen, recordSearch, accountAction === 'select_existing' ? selectedAccountId : null);
  const existingAccounts = providedAccounts ?? options.data?.accounts ?? [];
  const existingContacts = providedContacts ?? options.data?.contacts ?? [];
  const existingOpportunities = options.data?.opportunities ?? [];
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<any | null>(null);

  // Source conversion form state.
  const [accountName, setAccountName] = useState(lead.company_name || `${lead.first_name} Company`);

  const [contactAction, setContactAction] = useState<'create_new' | 'select_existing'>('create_new');
  const [contactFirstName, setContactFirstName] = useState(lead.first_name);
  const [contactLastName, setContactLastName] = useState(lead.last_name);
  const [selectedContactId, setSelectedContactId] = useState(existingContacts[0]?.id || '');

  const [opportunityAction, setOpportunityAction] = useState<'create_new' | 'select_existing'>('create_new');
  const [opportunityName, setOpportunityName] = useState(
    lead.company_name ? `${lead.company_name} - Opportunity` : `${lead.title} Deal`
  );
  const [opportunityAmount, setOpportunityAmount] = useState<string>(
    lead.annual_revenue ? String(lead.annual_revenue) : ''
  );
  const nextMonth = new Date();
  const day = nextMonth.getDate();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  nextMonth.setDate(Math.min(day, lastDay));
  const defaultCloseDate = [nextMonth.getFullYear(), String(nextMonth.getMonth() + 1).padStart(2, '0'), String(nextMonth.getDate()).padStart(2, '0')].join('-');
  const [opportunityCloseDate, setOpportunityCloseDate] = useState(defaultCloseDate);

  if (!isOpen) return null;

  const handleExecuteConvert = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (accountAction === 'create_new' ? !accountName.trim() : !selectedAccountId) throw new Error('Choose an account or enter its name.');
      if (contactAction === 'create_new' ? !contactFirstName.trim() || !contactLastName.trim() : !selectedContactId) throw new Error('Choose a contact or enter first and last names.');
      if (opportunityAction === 'create_new' ? !opportunityName.trim() : !selectedOpportunityId) throw new Error('Choose an opportunity or enter its name.');
      if (opportunityAmount && (!Number.isFinite(Number(opportunityAmount)) || Number(opportunityAmount) < 0)) throw new Error('Amount must be nonnegative.');
      const payload: LeadConversionPayload = {
        leadId: lead.id,
        accountAction,
        accountId: accountAction === 'select_existing' ? selectedAccountId : null,
        accountName: accountAction === 'create_new' ? accountName.trim() : null,
        contactAction,
        contactId: contactAction === 'select_existing' ? selectedContactId : null,
        contactFirstName: contactAction === 'create_new' ? contactFirstName.trim() : null,
        contactLastName: contactAction === 'create_new' ? contactLastName.trim() : null,
        opportunityAction,
        opportunityId: opportunityAction === 'select_existing' ? selectedOpportunityId : null,
        opportunityName: opportunityAction === 'create_new' ? opportunityName.trim() : null,
        opportunityAmount: opportunityAction === 'create_new' && opportunityAmount ? Number(opportunityAmount) : null,
        opportunityCloseDate: opportunityAction === 'create_new' ? opportunityCloseDate : null,
        ownerId: lead.lead_owner_id || user?.id || null,
      };

      const result = await onConvert(payload);
      setConversionResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lead conversion failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Convert Lead</h2>
              <p className="text-xs text-slate-500">
                Transform &quot;{lead.title}&quot; into verified commercial entities
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Success Modal View */}
        {conversionResult ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="h-6 w-6 stroke-[3]" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Lead Converted Successfully!</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              The lead has been converted atomically. Associated business entities have been created and linked in the system.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-left space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-emerald-800" /> Account:
                </span>
                <span className="text-slate-900 font-medium">
                  {accountAction === 'create_new' ? accountName : 'Linked Existing Account'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-emerald-800" /> Contact:
                </span>
                <span className="text-slate-900 font-medium">
                  {contactAction === 'create_new'
                    ? `${contactFirstName} ${contactLastName}`
                    : 'Linked Existing Contact'}
                </span>
              </div>
              {opportunityAction === 'create_new' && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-600" /> Opportunity:
                  </span>
                  <span className="text-slate-900 font-medium">{opportunityName}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-600 rounded-md transition shadow-xs"
            >
              Done & Return to Leads
            </button>
          </div>
        ) : (
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5 text-xs text-slate-700">
            <label className="block text-xs">Search existing records (contacts by first name)
              <input type="search" value={recordSearch} onChange={e => setRecordSearch(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" />
            </label>
            {options.isFetching && <p role="status">Loading records…</p>}
            {options.isError && <p role="alert">Unable to load existing records. Try again.</p>}
            <p className="text-slate-500">Up to 50 authorized matches per record type. Refine search for more results.</p>
            {/* Section 1: Account */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-emerald-800" />
                  <span>Account</span>
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="accountAction"
                      value="create_new"
                      checked={accountAction === 'create_new'}
                      onChange={() => { setAccountAction('create_new'); setSelectedOpportunityId(''); }}
                      className="text-emerald-800 focus:ring-emerald-500"
                    />
                    <span>Create New</span>
                  </label>
                  {existingAccounts.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="accountAction"
                        value="select_existing"
                        checked={accountAction === 'select_existing'}
                        onChange={() => setAccountAction('select_existing')}
                        className="text-emerald-800 focus:ring-emerald-500"
                      />
                      <span>Select Existing</span>
                    </label>
                  )}
                </div>
              </div>

              {accountAction === 'create_new' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select Account
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => { setSelectedAccountId(e.target.value); setSelectedOpportunityId(''); }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select Account</option>
                    {existingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Section 2: Contact */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4 text-emerald-800" />
                  <span>Contact</span>
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="contactAction"
                      value="create_new"
                      checked={contactAction === 'create_new'}
                      onChange={() => setContactAction('create_new')}
                      className="text-emerald-800 focus:ring-emerald-500"
                    />
                    <span>Create New</span>
                  </label>
                  {existingContacts.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="contactAction"
                        value="select_existing"
                        checked={contactAction === 'select_existing'}
                        onChange={() => setContactAction('select_existing')}
                        className="text-emerald-800 focus:ring-emerald-500"
                      />
                      <span>Select Existing</span>
                    </label>
                  )}
                </div>
              </div>

              {contactAction === 'create_new' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactFirstName}
                      onChange={(e) => setContactFirstName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactLastName}
                      onChange={(e) => setContactLastName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select Contact
                  </label>
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select Contact</option>
                    {existingContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Section 3: Opportunity */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span>Opportunity</span>
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="opportunityAction"
                      value="create_new"
                      checked={opportunityAction === 'create_new'}
                      onChange={() => setOpportunityAction('create_new')}
                      className="text-emerald-800 focus:ring-emerald-500"
                    />
                    <span>Create New</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="opportunityAction"
                      value="select_existing"
                      checked={opportunityAction === 'select_existing'}
                      onChange={() => setOpportunityAction('select_existing')}
                      className="text-emerald-800 focus:ring-emerald-500"
                    />
                    <span>Select Existing</span>
                  </label>
                </div>
              </div>

              {opportunityAction === 'create_new' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Opportunity Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={opportunityName}
                      onChange={(e) => setOpportunityName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Amount (INR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={opportunityAmount}
                        onChange={(e) => setOpportunityAmount(e.target.value)}
                        placeholder="2500000"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Closing Date
                      </label>
                      <input
                        type="date"
                        value={opportunityCloseDate}
                        onChange={(e) => setOpportunityCloseDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {opportunityAction === 'select_existing' && (
              <label className="block">Opportunity Name
                <select disabled={accountAction !== 'select_existing' || !selectedAccountId} value={selectedOpportunityId} onChange={e => setSelectedOpportunityId(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2">
                  <option value="">{accountAction === 'select_existing' && selectedAccountId ? 'Select Opportunity' : 'Please select an account first'}</option>
                  {existingOpportunities.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            )}
            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConvert}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-600 rounded-md transition shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Converting...' : 'Convert'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
