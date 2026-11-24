'use client';

import React, { useState } from 'react';
import { LeadCustomFormFields, type LeadCustomValues } from './lead-custom-form-fields';
import { LeadFormGrid } from './lead-form-grid';
import { useLeadFormMetadata, useLeadFormLayoutPreference, missingLeadFormField } from '@/hooks/use-lead-form-metadata';
import { useLeadAssignees } from '@/hooks/use-lead-assignees';
import { X, Check, ArrowRight, ArrowLeft, Lock, Plus } from 'lucide-react';
import {
  LEAD_SOURCES,
  INDUSTRY_CHOICES,
  CANONICAL_LEAD_STAGES,
  type LeadInsert,
} from '@/types/leads';
import { useAuth } from '@/components/providers/auth-provider';

interface LeadCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lead: LeadInsert, saveAndNew?: boolean, custom?: LeadCustomValues) => Promise<void>;
  bdoUsers?: { id: string; first_name: string; last_name: string; email: string }[];
  duplicateDraft?: Record<string, string>;
}

export function LeadCreateModal({
  isOpen,
  onClose,
  onSubmit,
  bdoUsers: providedUsers,
  duplicateDraft,
}: LeadCreateModalProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [configuredLayout, setConfiguredLayout] = useLeadFormLayoutPreference();
  const [mode, setMode] = useState<'single' | 'wizard'>('single');
  const assignees = useLeadAssignees(isOpen);
  const metadata = useLeadFormMetadata(isOpen);
  const [custom, setCustom] = useState<LeadCustomValues>({});
  const bdoUsers = providedUsers ?? assignees.data ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const initialForm = {
    first_name: '',
    last_name: '',
    title: '',
    email: '',
    phone: '',
    fax: '',
    lead_source: 'website',
    status: 'new',
    sub_owner_id: '',
    company_name: '',
    no_of_employees: '',
    industry: 'finance',
    annual_revenue: '',
    country: 'India',
    state: '',
    city: '',
    zip_code: '',
    requirements: '',
  };

  const [form, setForm] = useState(() => ({ ...initialForm, ...duplicateDraft }));

  const keepVisible = ['first_name', 'last_name', 'email', 'company_name',
    ...(metadata.data?.fields.filter(field => field.required && field.access === 'write').map(field => field.key) ?? [])];
  const chosenLayout = configuredLayout ? metadata.data?.layout : null;

  if (!isOpen) return null;

  const currentUserName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || profile.email
    : 'Current User';

  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!form.first_name.trim()) {
        setErrorMsg('First Name is required.');
        return false;
      }
      if (!form.last_name.trim()) {
        setErrorMsg('Last Name is required.');
        return false;
      }
      if (!form.email.trim() || !form.email.includes('@')) {
        setErrorMsg('A valid Email address is required.');
        return false;
      }
    } else if (currentStep === 2) {
      if (!form.company_name.trim()) {
        setErrorMsg('Company Name is required.');
        return false;
      }
      if (form.no_of_employees && Number(form.no_of_employees) < 0) {
        setErrorMsg('Total Employees must be greater than or equal to 0.');
        return false;
      }
      if (form.annual_revenue && Number(form.annual_revenue) < 0) {
        setErrorMsg('Annual Revenue cannot be negative.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSave = async (saveAndNew = false) => {
    const missing = missingLeadFormField(metadata.data, form);
    if (missing) { setErrorMsg(missing.label + ' is required.'); return; }
    if (!validateStep(1) || !validateStep(2)) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const generatedTitle =
        form.title.trim() ||
        `${form.company_name.trim()}/${form.first_name.trim()}/${profile?.email || 'user'}`;

      const payload: LeadInsert = {
        title: generatedTitle,
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

      await onSubmit(payload, saveAndNew, custom);

      if (saveAndNew) {
        setForm(initialForm);
        setCustom({});
        setStep(1);
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    'Basic Information',
    'Company Details',
    'Location',
    'Requirements',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">{duplicateDraft ? 'Duplicate Lead' : 'Create Lead'}</h2>
            <label className="text-xs text-slate-500">Form layout <select value={mode} disabled={isSubmitting} onChange={e => setMode(e.target.value as 'single' | 'wizard')}><option value="single">Single-step</option><option value="wizard">Multi-step</option></select></label>
            {mode === 'wizard' && <p className="text-xs text-slate-500">Step {step} of 4: {stepTitles[step - 1]}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div hidden={mode !== 'wizard'} className="px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 z-0" />
            {[1, 2, 3, 4].map((s) => {
              const isPast = s < step;
              const isCurrent = s === step;
              return (
                <div key={s} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      isCurrent
                        ? 'bg-emerald-600 text-white ring-4 ring-blue-100 shadow-xs'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isPast ? <Check className="h-4 w-4" /> : s}
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 mt-1 hidden sm:block">
                    {stepTitles[s - 1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-xs">
          {Boolean(metadata.data?.layout?.length) && <label className="flex items-center gap-2">
            Field order
            <select className="rounded border px-2 py-1" value={configuredLayout ? 'configured' : 'default'}
              onChange={event => setConfiguredLayout(event.target.value === 'configured')}>
              <option value="default">Default</option>
              <option value="configured">Custom Layout</option>
            </select>
          </label>}
          {mode === 'single' && <LeadFormGrid layout={chosenLayout} keepVisible={keepVisible} access={metadata.data?.access}>
            <label>Lead Owner<input value={currentUserName} disabled className="block w-full rounded border p-2" /></label>
            <label data-field="title">Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="first_name">First Name<input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="last_name">Last Name<input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="email">Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="phone">Contact Number<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="block w-full rounded border p-2" /></label>
            {assignees.canAssign && (
              <label data-field="sub_owner_id">Assigned BDO<select value={form.sub_owner_id} disabled={assignees.isFetching || assignees.isError}
                onChange={event => setForm({ ...form, sub_owner_id: event.target.value })} className="block w-full rounded border p-2">
                <option value="">Unassigned</option>
                {bdoUsers.map(user => <option key={user.id} value={user.id}>{user.first_name} {user.last_name}</option>)}
              </select></label>
            )}
            <label data-field="lead_source">Lead Source<select value={form.lead_source} onChange={e => setForm({ ...form, lead_source: e.target.value })} className="block w-full rounded border p-2">{LEAD_SOURCES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label data-field="status">Lead Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="block w-full rounded border p-2">{CANONICAL_LEAD_STAGES.filter(s => !s.isFinal).map(s => ({ value: s.id, label: s.name })).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label data-field="company_name">Company<input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="no_of_employees">Total Employees<input type="number" min="0" value={form.no_of_employees} onChange={e => setForm({ ...form, no_of_employees: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="industry">Industry<select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="block w-full rounded border p-2">{INDUSTRY_CHOICES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label data-field="annual_revenue">Annual Revenue<input type="number" min="0" value={form.annual_revenue} onChange={e => setForm({ ...form, annual_revenue: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="country">Country<input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="state">State<input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="city">City<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="zip_code">Zip Code<input value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="fax">Fax<input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} className="block w-full rounded border p-2" /></label>
            <label data-field="requirements">Requirements<textarea value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} className="block w-full rounded border p-2" /></label>
          </LeadFormGrid>}
          {(mode === 'single' || step === 4) && <LeadCustomFormFields definition={metadata.data}
            configured={configuredLayout} values={custom} onChange={(key, value) => setCustom(old => ({ ...old, [key]: value }))} />}
          {/* STEP 1: Basic Information */}
          {mode === 'wizard' && step === 1 && (
            <LeadFormGrid layout={chosenLayout} keepVisible={keepVisible} access={metadata.data?.access}>
              {/* Lead Owner (Locked to current user) */}
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span>Lead Owner</span>
                  <Lock className="h-3 w-3 text-slate-400" />
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUserName}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded text-slate-600 text-xs cursor-not-allowed italic"
                />
              </div>

              {/* Title / Reference */}
              <div data-field="title">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Lead Title <span className="text-slate-400 font-normal">(Auto-generated if empty)</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Acme Corp Acquisition"
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
                  placeholder="John"
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
                  placeholder="Doe"
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
                  placeholder="john.doe@company.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Phone */}
              <div data-field="phone">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Contact Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
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
                  {LEAD_SOURCES.map((src) => (
                    <option key={src.value} value={src.value}>
                      {src.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lead Status (Non-final stages) */}
              <div data-field="status">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Lead Stage
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  {CANONICAL_LEAD_STAGES.filter((s) => !s.isFinal).map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name} ({stage.probability}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned BDO (sub_owner) */}
              {assignees.canAssign && (
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assign to BDO (Optional Sub-Owner)
                  </label>
                  <select
                    disabled={assignees.isFetching || assignees.isError}
                    value={form.sub_owner_id}
                    onChange={(e) => setForm({ ...form, sub_owner_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- No BDO Assigned --</option>
                    {bdoUsers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.first_name} {b.last_name} ({b.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </LeadFormGrid>
          )}

          {/* STEP 2: Company Details */}
          {mode === 'wizard' && step === 2 && (
            <LeadFormGrid layout={chosenLayout} keepVisible={keepVisible} access={metadata.data?.access}>
              <div data-field="company_name" className="md:col-span-2">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Acme Industrial Ltd."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div data-field="no_of_employees">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Total Employees
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.no_of_employees}
                  onChange={(e) => setForm({ ...form, no_of_employees: e.target.value })}
                  placeholder="150"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div data-field="industry">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Industry
                </label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  {INDUSTRY_CHOICES.map((ind) => (
                    <option key={ind.value} value={ind.value}>
                      {ind.label}
                    </option>
                  ))}
                </select>
              </div>

              <div data-field="annual_revenue" className="md:col-span-2">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Annual Revenue (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.annual_revenue}
                  onChange={(e) => setForm({ ...form, annual_revenue: e.target.value })}
                  placeholder="2500000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </LeadFormGrid>
          )}

          {/* STEP 3: Address Details */}
          {mode === 'wizard' && step === 3 && (
            <LeadFormGrid layout={chosenLayout} keepVisible={keepVisible} access={metadata.data?.access}>
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

              <div data-field="state">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  State / Province
                </label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="Maharashtra"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div data-field="city">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Mumbai"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div data-field="zip_code">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  ZIP / Postal Code
                </label>
                <input
                  type="text"
                  value={form.zip_code}
                  onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                  placeholder="400001"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </LeadFormGrid>
          )}

          {/* STEP 4: Requirements */}
          {mode === 'wizard' && step === 4 && (
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Client Requirements & Sales Notes
              </label>
              <textarea
                rows={6}
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                placeholder="Describe deal size, technology specifications, decision timeframe, and initial discovery notes..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500 resize-y"
              />
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div>
            {mode === 'wizard' && step > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md hover:bg-white transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mode === 'wizard' && step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-600 rounded-md transition shadow-xs"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 border border-emerald-200 rounded-md transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save & New</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-600 rounded-md transition shadow-xs"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Lead</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
