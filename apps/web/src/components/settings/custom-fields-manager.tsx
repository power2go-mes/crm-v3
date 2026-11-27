'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Database, Plus, CheckCircle2, XCircle, Tag, Filter, Pencil, Trash2 } from 'lucide-react';
import { putCustomField, archiveCustomField } from '@/lib/settings/custom-fields';

interface FieldDefinition {
  id: string;
  module: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  is_custom: boolean;
  archived: boolean;
  choices: string[];
  position: number;
}

export function CustomFieldsManager() {
  const { user, profile, permissions, isLoading: authLoading, hasPermission } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [activeModule, setActiveModule] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [module, setModule] = useState('leads');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('small_text');
  const [required, setRequired] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [choiceText, setChoiceText] = useState('');
  const [position, setPosition] = useState(0);
  const [notice, setNotice] = useState('');
  const cacheKey = ['crm', user?.id, 'custom-fields'];

  const { data: fields = [], isLoading, error: loadError, refetch } = useQuery<FieldDefinition[]>({
    queryKey: [...cacheKey, [...permissions].sort().join('|')],
    enabled: !authLoading && !!user && !!profile?.is_active && hasPermission('settings.view'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_field_definitions')
        .select('*')
        .eq('archived', false)
        .order('module', { ascending: true })
        .order('position', { ascending: true })
        .limit(501);

      if (error) throw error;
      if ((data?.length ?? 0) > 500) throw new Error('Field registry exceeds the current 500-field editor limit.');
      return (data || []) as unknown as FieldDefinition[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const formattedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      return putCustomField(supabase, {
          id: editingId ?? crypto.randomUUID(),
          module,
          key: formattedKey,
          label: label.trim(),
          type,
          required,
          order: position,
          choices: ['choice', 'single_choice'].includes(type) ? choiceText.split(',').map(value => value.trim()).filter(Boolean) : [],
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', user?.id] });
      setKey('');
      setLabel('');
      setIsCreating(false);
      setError('');
      setEditingId(null);
      setNotice('Custom Field saved.');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create custom field definition');
    },
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveCustomField(supabase, id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['crm', user?.id] }); setNotice('Custom Field deleted from active forms. Existing values and history are retained.'); },
  });

  const filteredFields =
    activeModule === 'all' ? fields : fields.filter((f) => f.module === activeModule);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#eef2ff] text-[#4361ee] border border-indigo-100">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Custom Fields & Schema Registry</h3>
            <p className="text-xs text-slate-500">
              Browse standard attributes and configure dynamic metadata fields across core CRM modules.
            </p>
          </div>
        </div>

        {hasPermission('settings.update') && (
          <button
            type="button"
            onClick={() => { setEditingId(null); setKey(''); setLabel(''); setType('small_text'); setRequired(false); setPosition(0); setChoiceText(''); setError(''); setIsCreating(!isCreating); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4361ee] hover:bg-[#3a5bf0] text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Custom Field</span>
          </button>
        )}
      </div>

      {/* Module Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        {['all', 'leads', 'accounts', 'contacts', 'opportunities', 'campaigns'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setActiveModule(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              activeModule === m
                ? 'bg-[#4361ee] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
            }`}
          >
            {m === 'all' ? 'All Modules' : m}
          </button>
        ))}
      </div>

      {isCreating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {editingId ? 'Edit Custom Field' : 'New Custom Field'}
            </span>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Target Module *
              </label>
              <select
                value={module}
                disabled={!!editingId}
                onChange={(e) => setModule(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 capitalize focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
              >
                <option value="leads">Leads</option>
                <option value="accounts">Accounts</option>
                <option value="contacts">Contacts</option>
                <option value="opportunities">Opportunities</option>
                <option value="campaigns">Campaigns</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Field Label *
              </label>
              <input
                type="text"
                required
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (!key) {
                    setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }
                }}
                placeholder="e.g. Contract Expiration Date"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Attribute Key (System ID) *
              </label>
              <input
                type="text"
                required
                value={key}
                disabled={!!editingId}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. contract_expiration_date"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Data Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
              >
                <option value="small_text">Short Text (255 chars)</option>
                <option value="large_text">Long Text / Paragraph</option>
                <option value="number">Numeric</option>
                <option value="choice">Multiple Choice</option>
                <option value="single_choice">Single Choice</option>
                <option value="date">Date</option>
                <option value="datetime">Date & Time</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="reqCheck"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#4361ee] focus:ring-[#4361ee]"
              />
              <label htmlFor="reqCheck" className="text-xs text-slate-700 font-medium">
                Mandatory Field
              </label>
            </div>
          </div>

          {['choice', 'single_choice'].includes(type) && (
            <label className="block text-xs text-slate-700 font-medium">
              Choices
              <textarea
                required
                value={choiceText}
                onChange={(e) => setChoiceText(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
              />
            </label>
          )}

          <label className="block text-xs text-slate-700 font-medium">
            Display Order
            <input
              type="number"
              min={0}
              step={1}
              required
              value={position}
              onChange={(e) => setPosition(e.target.valueAsNumber)}
              className="mt-1 block w-40 rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
            />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 bg-[#4361ee] hover:bg-[#3a5bf0] text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 transition"
            >
              {createMutation.isPending ? 'Saving...' : editingId ? 'Save' : 'Register Field'}
            </button>
          </div>
        </form>
      )}

      {/* Field Registry List */}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {loadError && <p role="alert" className="text-sm text-red-700">{loadError.message} <button onClick={() => void refetch()}>Retry</button></p>}
      {archive.error && <p role="alert" className="text-sm text-red-700">{archive.error.message}</p>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading && (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading field definitions...
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filteredFields.map((field) => (
            <div
              key={field.id}
              className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/80 transition text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {field.module}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{field.label}</span>
                    <span className="font-mono text-[11px] text-slate-500">({field.key})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Type: <span className="text-[#4361ee] font-medium">{field.type}</span> •{' '}
                    {field.is_custom ? 'Custom Dynamic Field' : 'Core System Field'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {field.is_custom && hasPermission('settings.update') && (
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      type="button"
                      aria-label={`Edit ${field.label}`}
                      onClick={() => {
                        setEditingId(field.id);
                        setModule(field.module);
                        setKey(field.key);
                        setLabel(field.label);
                        setType(field.type);
                        setRequired(field.required);
                        setChoiceText(field.choices.join(', '));
                        setPosition(field.position);
                        setError('');
                        setIsCreating(true);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={archive.isPending}
                      aria-label={`Delete ${field.label}`}
                      onClick={() => {
                        if (window.confirm(`Delete ${field.label} from active forms? Its stored values and history will be retained.`)) {
                          archive.mutate(field.id);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {field.required && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Required
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    field.is_custom
                      ? 'bg-[#eef2ff] text-[#4361ee] border border-indigo-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {field.is_custom ? 'Custom' : 'Standard'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
