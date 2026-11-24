'use client';

import React, { useState } from 'react';
import { LeadCustomFormFields, useLeadCustomFormValues, type LeadCustomValues } from './lead-custom-form-fields';
import { LeadFormGrid } from './lead-form-grid';
import { useLeadFormMetadata, useLeadFormLayoutPreference, missingLeadFormField } from '@/hooks/use-lead-form-metadata';
import { useLeadAssignees } from '@/hooks/use-lead-assignees';
import { X, Check, Lock } from 'lucide-react';
import {
  LEAD_SOURCES,
  INDUSTRY_CHOICES,
  CANONICAL_LEAD_STAGES,
  type LeadWithRelations,
  type LeadUpdate,
} from '@/types/leads';

interface LeadEditModalProps {
  isOpen: boolean;
  lead: LeadWithRelations;
  onClose: () => void;
  onSubmit: (updates: LeadUpdate, custom?: LeadCustomValues) => Promise<void>;
  bdoUsers?: { id: string; first_name: string; last_name: string; email: string }[];
}

export function LeadEditModal({
  isOpen,
  lead,
  onClose,
  onSubmit,
  bdoUsers: providedUsers,
}: LeadEditModalProps) {
  const assignees = useLeadAssignees(isOpen);
  const metadata = useLeadFormMetadata(isOpen);
  const [custom, setCustom] = useState<LeadCustomValues>({});
  const existingCustom = useLeadCustomFormValues(isOpen ? lead.id : undefined);
  const [configuredLayout, setConfiguredLayout] = useLeadFormLayoutPreference();
  const bdoUsers = providedUsers ?? assignees.data ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: lead.title || '',
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    fax: lead.fax || '',
    company_name: lead.company_name || '',
    status: lead.status || 'new',
    lead_source: lead.lead_source || 'website',
    industry: lead.industry || 'finance',
    no_of_employees: lead.no_of_employees?.toString() || '',
    annual_revenue: lead.annual_revenue?.toString() || '',
    country: lead.country || 'India',
    state: lead.state || '',
    city: lead.city || '',
    zip_code: lead.zip_code || '',
    requirements: lead.requirements || '',
    sub_owner_id: lead.sub_owner_id || '',
  });

  const keepVisible = ['first_name', 'last_name', 'email', 'company_name',
    ...(metadata.data?.fields.filter(field => field.required && field.access === 'write').map(field => field.key) ?? [])];
  const chosenLayout = configuredLayout ? metadata.data?.layout : null;

  if (!isOpen) return null;

  const ownerName = lead.lead_owner
    ? `${lead.lead_owner.first_name} ${lead.lead_owner.last_name}`.trim() || lead.lead_owner.email
    : 'System Owner';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = missingLeadFormField(metadata.data, form);
    if (missing) { setErrorMsg(missing.label + ' is required.'); return; }
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || !form.company_name.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const updates: LeadUpdate = {
        title: form.title.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        fax: form.fax.trim() || null,
        company_name: form.company_name.trim(),
        status: form.status,
        lead_source: form.lead_source,
        industry: form.industry,
        no_of_employees: form.no_of_employees ? Number(form.no_of_employees) : null,
        annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : null,
        country: form.country || 'India',
        state: form.state.trim() || null,
        city: form.city.trim() || null,
        zip_code: form.zip_code.trim() || null,
        requirements: form.requirements.trim() || null,
        sub_owner_id: form.sub_owner_id || null,
      };

      await onSubmit(updates, custom);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Edit Lead</h2>
            <p className="text-xs text-slate-500">Update record attributes and territory assignment</p>
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

        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4 text-xs">
            {Boolean(metadata.data?.layout?.length) && <label className="flex items-center gap-2">
              Field order
              <select value={configuredLayout ? 'configured' : 'default'} onChange={event => setConfiguredLayout(event.target.value === 'configured')}>
                <option value="default">Default</option>
                <option value="configured">Custom Layout</option>
              </select>
            </label>}
            <LeadFormGrid layout={chosenLayout} keepVisible={keepVisible} access={metadata.data?.access}>
              {/* Owner (Locked) */}
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span>Lead Owner</span>
                  <Lock className="h-3 w-3 text-slate-400" />
                </label>
                <input
                  type="text"
                  disabled
                  value={ownerName}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded text-slate-600 text-xs cursor-not-allowed italic"
                />
              </div>

              {/* Title */}
              <div data-field="title">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Lead Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* First Name */}
              <div data-field="first_name">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Last Name */}
              <div data-field="last_name">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Email */}
              <div data-field="email">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Phone */}
              <div data-field="phone">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Company */}
              <div data-field="company_name">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Status */}
              <div data-field="status">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  {CANONICAL_LEAD_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.probability}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Lead Source */}
              <div data-field="lead_source">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Lead Source
                </label>
                <select
                  value={form.lead_source}
                  onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Industry */}
              <div data-field="industry">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Industry
                </label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  {INDUSTRY_CHOICES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Employees */}
              <div data-field="no_of_employees">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Employees
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.no_of_employees}
                  onChange={(e) => setForm({ ...form, no_of_employees: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Revenue */}
              <div data-field="annual_revenue">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Annual Revenue (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.annual_revenue}
                  onChange={(e) => setForm({ ...form, annual_revenue: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Country */}
              <div data-field="country">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* State */}
              <div data-field="state">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  State / Province
                </label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* City */}
              <div data-field="city">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* ZIP */}
              <div data-field="zip_code">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  ZIP / Postal Code
                </label>
                <input
                  type="text"
                  value={form.zip_code}
                  onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Assigned BDO */}
              {assignees.canAssign && (
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned BDO (Sub-Owner)
                  </label>
                  <select
                    disabled={assignees.isFetching || assignees.isError}
                    value={form.sub_owner_id}
                    onChange={(e) => setForm({ ...form, sub_owner_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- No BDO Assigned --</option>
                    {form.sub_owner_id && !bdoUsers.some(user => user.id === form.sub_owner_id) &&
                      <option value={form.sub_owner_id}>Current assignee</option>}
                    {bdoUsers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.first_name} {b.last_name} ({b.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Requirements */}
              <div data-field="requirements" className="md:col-span-2">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Requirements & Notes
                </label>
                <textarea
                  rows={4}
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500 resize-y"
                />
              </div>
            </LeadFormGrid>
            <LeadCustomFormFields definition={metadata.data} configured={configuredLayout}
              values={{ ...existingCustom.data, ...custom }} onChange={(key, value) => setCustom(old => ({ ...old, [key]: value }))} />

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md hover:bg-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-600 rounded-md transition shadow-xs"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
