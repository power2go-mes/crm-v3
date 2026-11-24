'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import {
  X,
  Code2,
  Plus,
  Copy,
  Check,
  Eye,
  Globe,
  Settings,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export interface LeadCaptureForm {
  id: string;
  form_name: string;
  selected_fields: string[];
  lead_owner_id: string | null;
  return_url_enable: boolean;
  return_url: string | null;
  success_message: string;
  success_description: string | null;
  header_color: string;
  is_active: boolean;
  submission_count: number;
  created_at: string;
}

interface WebToLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_FIELDS = [
  { id: 'first_name', label: 'First Name', required: true },
  { id: 'last_name', label: 'Last Name', required: true },
  { id: 'email', label: 'Email Address', required: true },
  { id: 'phone', label: 'Phone Number', required: false },
  { id: 'company_name', label: 'Company Name', required: false },
  { id: 'requirements', label: 'Requirements / Message', required: false },
];

export function WebToLeadModal({ isOpen, onClose }: WebToLeadModalProps) {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'embed'>('list');
  const [selectedForm, setSelectedForm] = useState<LeadCaptureForm | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state for creating a new form
  const [formName, setFormName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'first_name',
    'last_name',
    'email',
    'phone',
    'company_name',
  ]);
  const [leadOwnerId, setLeadOwnerId] = useState<string>('');
  const [headerColor, setHeaderColor] = useState('#2563EB');
  const [successMessage, setSuccessMessage] = useState('Thank you for reaching out!');
  const [successDescription, setSuccessDescription] = useState('Our team will contact you shortly.');
  const [returnUrlEnable, setReturnUrlEnable] = useState(false);
  const [returnUrl, setReturnUrl] = useState('');

  // 1. Query users for owner dropdown
  const usersQuery = useQuery({
    queryKey: ['lead-owners'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .eq('is_active', true);
      return data ?? [];
    },
  });

  // 2. Query existing forms
  const { data: forms = [], isLoading, refetch } = useQuery<LeadCaptureForm[]>({
    queryKey: ['lead-capture-forms'],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_lead_capture_forms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as LeadCaptureForm[]) ?? [];
    },
  });

  // 3. Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('crm_lead_capture_forms')
        .insert({
          form_name: formName.trim() || 'Website Lead Form',
          selected_fields: selectedFields,
          lead_owner_id: leadOwnerId || null,
          header_color: headerColor,
          success_message: successMessage,
          success_description: successDescription,
          return_url_enable: returnUrlEnable,
          return_url: returnUrlEnable ? returnUrl.trim() : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (newForm: LeadCaptureForm) => {
      queryClient.invalidateQueries({ queryKey: ['lead-capture-forms'] });
      setSelectedForm(newForm);
      setActiveTab('embed');
    },
  });

  // 4. Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('crm_lead_capture_forms')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-capture-forms'] });
    },
  });

  const generateEmbedSnippet = (form: LeadCaptureForm) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crm.finlonexa.com';
    const endpoint = `${origin}/api/web-to-lead`;

    const inputsHtml = (form.selected_fields || [])
      .map(fieldId => {
        const fieldMeta = AVAILABLE_FIELDS.find(f => f.id === fieldId);
        const label = fieldMeta?.label || fieldId;
        const isRequired = fieldMeta?.required;

        if (fieldId === 'requirements') {
          return `    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #334155;">${label}</label>
      <textarea name="${fieldId}" rows="3" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" placeholder="How can we help?"></textarea>
    </div>`;
        }

        return `    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #334155;">${label} ${isRequired ? '<span style="color: #ef4444;">*</span>' : ''}</label>
      <input type="${fieldId === 'email' ? 'email' : fieldId === 'phone' ? 'tel' : 'text'}" name="${fieldId}" ${isRequired ? 'required' : ''} style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
    </div>`;
      })
      .join('\n');

    return `<!-- FINLONEXA CRM Web-To-Lead Embed Form -->
<form action="${endpoint}" method="POST" style="max-width: 440px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <div style="border-top: 4px solid ${form.header_color || '#2563EB'}; margin: -24px -24px 20px -24px; border-radius: 12px 12px 0 0;"></div>
  <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">${form.form_name}</h3>
  
  <input type="hidden" name="form_id" value="${form.id}" />

${inputsHtml}

  <button type="submit" style="width: 100%; background: ${form.header_color || '#2563EB'}; color: #ffffff; font-weight: 600; font-size: 14px; padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer; transition: opacity 0.2s;">
    Submit Inquiry
  </button>
</form>`;
  };

  const handleCopySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Web-to-Lead Capture Engine</h3>
              <p className="text-xs text-slate-500">
                Embed lead generation forms on external websites and automatically route inquiries into FINLONEXA CRM.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'list'
                ? 'border-primary text-primary'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Configured Forms ({forms.length})
          </button>
          {hasPermission('leads.manage_web_forms') && (
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`py-3 px-3 border-b-2 transition ${
                activeTab === 'create'
                  ? 'border-primary text-primary'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              + Create New Form
            </button>
          )}
          {selectedForm && (
            <button
              type="button"
              onClick={() => setActiveTab('embed')}
              className={`py-3 px-3 border-b-2 transition ${
                activeTab === 'embed'
                  ? 'border-primary text-primary'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Embed Snippet & Preview
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: LIST FORMS */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading forms...</div>
              ) : forms.length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">No Web-to-Lead forms configured yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Your First Form</span>
                  </button>
                </div>
              ) : (
                forms.map((form) => (
                  <div
                    key={form.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition flex items-center justify-between bg-white shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: form.header_color || '#2563EB' }}
                        />
                        <h4 className="text-xs font-bold text-slate-900">{form.form_name}</h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            form.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {form.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Fields: {(form.selected_fields || []).join(', ')} • {form.submission_count} total submissions
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedForm(form);
                          setActiveTab('embed');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                      >
                        <Code2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Get Embed Code</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: form.id,
                            isActive: !form.is_active,
                          })
                        }
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                          form.is_active
                            ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {form.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: CREATE FORM */}
          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Form Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Website Contact Page Form"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Form Fields
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_FIELDS.map(f => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 text-xs text-slate-700 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(f.id)}
                        disabled={f.required}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedFields(prev => [...prev, f.id]);
                          } else {
                            setSelectedFields(prev => prev.filter(x => x !== f.id));
                          }
                        }}
                        className="rounded-sm border-slate-300 text-primary"
                      />
                      <span>{f.label}</span>
                      {f.required && (
                        <span className="text-[10px] text-slate-400 italic">(Required)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Lead Owner
                  </label>
                  <select
                    value={leadOwnerId}
                    onChange={e => setLeadOwnerId(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Auto-assign to Head of Sales / Admin</option>
                    {(usersQuery.data || []).map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={headerColor}
                      onChange={e => setHeaderColor(e.target.value)}
                      className="h-8 w-12 rounded-sm border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={headerColor}
                      onChange={e => setHeaderColor(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Success Message
                </label>
                <input
                  type="text"
                  value={successMessage}
                  onChange={e => setSuccessMessage(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !formName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-xs transition disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Generating...' : 'Save & Generate Embed Code'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EMBED SNIPPET & PREVIEW */}
          {activeTab === 'embed' && selectedForm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{selectedForm.form_name}</h4>
                  <p className="text-[11px] text-slate-500">Copy this HTML code into your website CMS (WordPress, Webflow, Shopify, etc.).</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopySnippet(generateEmbedSnippet(selectedForm))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Embed Code'}</span>
                </button>
              </div>

              {/* Code preview block */}
              <div className="relative rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-48 border border-slate-200">
                <pre>{generateEmbedSnippet(selectedForm)}</pre>
              </div>

              {/* Live Form Visual Preview */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-3">
                  <Eye className="h-4 w-4 text-primary" />
                  <span>Live Render Preview</span>
                </div>

                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
                  <div className="w-full max-w-md bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div
                      className="h-1.5 w-full"
                      style={{ backgroundColor: selectedForm.header_color || '#2563EB' }}
                    />
                    <div className="p-5">
                      <h4 className="text-sm font-bold text-slate-900 mb-3">{selectedForm.form_name}</h4>
                      <div className="space-y-2.5">
                        {selectedForm.selected_fields.map((fId) => {
                          const meta = AVAILABLE_FIELDS.find(f => f.id === fId);
                          return (
                            <div key={fId}>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                {meta?.label || fId}
                              </label>
                              <input
                                type="text"
                                disabled
                                placeholder={`Enter ${meta?.label || fId}`}
                                className="w-full text-xs p-2 border border-slate-200 rounded-md bg-slate-50 cursor-not-allowed"
                              />
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          disabled
                          className="w-full text-xs font-semibold text-white py-2 rounded-lg mt-2 cursor-not-allowed"
                          style={{ backgroundColor: selectedForm.header_color || '#2563EB' }}
                        >
                          Submit Inquiry
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
