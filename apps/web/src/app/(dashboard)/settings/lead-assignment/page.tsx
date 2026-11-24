'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  GitFork,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  UserCheck,
  RotateCw,
  X,
  AlertCircle,
  Save,
} from 'lucide-react';
import Link from 'next/link';

export interface AssignmentRule {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  criteria: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  assign_to_type: 'user' | 'role' | 'round_robin';
  assigned_user_id: string | null;
  round_robin_user_ids: string[];
  last_assigned_index: number;
  notify: boolean;
  assigned_user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    department?: string | null;
    designation?: string | null;
  } | null;
}

const CRITERIA_FIELDS = [
  { id: 'country', label: 'Country' },
  { id: 'state', label: 'State / Region' },
  { id: 'city', label: 'City' },
  { id: 'industry', label: 'Industry' },
  { id: 'lead_source', label: 'Lead Source' },
  { id: 'company_name', label: 'Company Name' },
  { id: 'title', label: 'Job Title' },
  { id: 'status', label: 'Lead Status' },
];

const CRITERIA_OPERATORS = [
  { id: 'equals', label: 'equals (case-insensitive)' },
  { id: 'not_equals', label: 'not equals' },
  { id: 'contains', label: 'contains' },
  { id: 'not_contains', label: 'does not contain' },
  { id: 'starts_with', label: 'starts with' },
];

export default function LeadAssignmentPage() {
  const { hasPermission } = useAuth();
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [priority, setPriority] = useState<number>(1);
  const [assignType, setAssignType] = useState<'user' | 'round_robin'>('user');
  const [targetUserId, setTargetUserId] = useState('');
  const [roundRobinIds, setRoundRobinIds] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Criteria rows
  const [criteria, setCriteria] = useState<Array<{ field: string; operator: string; value: string }>>([
    { field: 'industry', operator: 'equals', value: '' },
  ]);

  // 1. Query users with active status
  const usersQuery = useQuery({
    queryKey: ['sales-reps-for-assignment'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, department, designation')
        .eq('is_active', true)
        .order('first_name', { ascending: true });
      return data ?? [];
    },
  });

  // 2. Query assignment rules in priority order
  const { data: rules = [], isLoading } = useQuery<AssignmentRule[]>({
    queryKey: ['lead-assignment-rules'],
    enabled: hasPermission('leads.view'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_lead_assignment_rules')
        .select(`
          *,
          assigned_user:user_profiles!assigned_user_id(id, first_name, last_name, email, department, designation)
        `)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as AssignmentRule[]) ?? [];
    },
  });

  // 3. Upsert mutation (Create or Edit)
  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!ruleName.trim()) throw new Error('Rule name is required.');
      const cleanCriteria = criteria.filter((c) => c.value.trim() !== '');

      const payload = {
        name: ruleName.trim(),
        description: ruleDescription.trim() || null,
        priority: Number(priority) || 1,
        assign_to_type: assignType,
        assigned_user_id: assignType === 'user' ? targetUserId || null : null,
        round_robin_user_ids: assignType === 'round_robin' ? roundRobinIds : [],
        criteria: cleanCriteria,
        notify,
        updated_at: new Date().toISOString(),
      };

      if (editingRuleId) {
        const { error } = await supabase
          .from('crm_lead_assignment_rules')
          .update(payload)
          .eq('id', editingRuleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_lead_assignment_rules').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignment-rules'] });
      setSuccessMessage(editingRuleId ? 'Rule updated successfully.' : 'New routing rule created.');
      setIsModalOpen(false);
      resetForm();
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to save assignment rule.');
    },
  });

  // 4. Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('crm_lead_assignment_rules')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignment-rules'] });
    },
  });

  // 5. Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_lead_assignment_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignment-rules'] });
      setSuccessMessage('Rule deleted.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  // 6. Move priority mutation
  const movePriority = async (index: number, direction: 'up' | 'down') => {
    if (rules.length <= 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const currentRule = rules[index];
    const targetRule = rules[targetIndex];

    try {
      // Swap priority values
      const currentPriority = currentRule.priority || index + 1;
      const targetPriority = targetRule.priority || targetIndex + 1;

      await Promise.all([
        supabase
          .from('crm_lead_assignment_rules')
          .update({ priority: targetPriority, updated_at: new Date().toISOString() })
          .eq('id', currentRule.id),
        supabase
          .from('crm_lead_assignment_rules')
          .update({ priority: currentPriority, updated_at: new Date().toISOString() })
          .eq('id', targetRule.id),
      ]);

      queryClient.invalidateQueries({ queryKey: ['lead-assignment-rules'] });
      setSuccessMessage('Rule execution priority updated.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reorder priority.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const resetForm = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleDescription('');
    setPriority(rules.length + 1);
    setAssignType('user');
    setTargetUserId('');
    setRoundRobinIds([]);
    setCriteria([{ field: 'industry', operator: 'equals', value: '' }]);
    setNotify(true);
    setErrorMessage(null);
  };

  const handleOpenEdit = (rule: AssignmentRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDescription(rule.description || '');
    setPriority(rule.priority || 1);
    setAssignType(rule.assign_to_type === 'round_robin' ? 'round_robin' : 'user');
    setTargetUserId(rule.assigned_user_id || '');
    setRoundRobinIds(rule.round_robin_user_ids || []);
    setCriteria(
      rule.criteria && rule.criteria.length > 0
        ? rule.criteria
        : [{ field: 'industry', operator: 'equals', value: '' }]
    );
    setNotify(rule.notify ?? true);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleAddCriteriaRow = () => {
    setCriteria((prev) => [...prev, { field: 'country', operator: 'equals', value: '' }]);
  };

  const handleRemoveCriteriaRow = (index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCriteriaRow = (index: number, key: string, val: string) => {
    setCriteria((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: val } : row))
    );
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-2 text-xs">
        <Link href="/settings" className="text-slate-500 hover:text-emerald-800 transition flex items-center gap-1">
          <span>Settings</span>
          <span>›</span>
          <span className="text-emerald-800 font-medium">Lead Auto-Assignment</span>
        </Link>
      </div>

      <PageHeader
        title="Lead Auto-Assignment Rules"
        subtitle="Automate lead routing by territory, industry, source, and round-robin rep distribution with priority ordering."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Settings</span>
            </Link>

            {hasPermission('leads.manage_assignment_rules') && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Routing Rule</span>
              </button>
            )}
          </div>
        }
      />

      <PermissionGate action="leads.view" showAccessDenied>
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitFork className="h-4 w-4 text-emerald-800" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Routing Pipeline ({rules.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Evaluated sequentially in priority order (lowest number first). First matching active rule routes the lead.
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading assignment rules...</div>
              ) : rules.length === 0 ? (
                <div className="p-12 text-center">
                  <GitFork className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-700" />
                  <h4 className="text-sm font-semibold text-slate-800">No Routing Rules Configured</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    New leads currently default to the form owner or unassigned. Create a rule to automatically distribute incoming leads to your reps.
                  </p>
                </div>
              ) : (
                rules.map((rule, idx) => (
                  <div key={rule.id} className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between dark:hover:bg-slate-800/40">
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 px-1.5 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-600/40 dark:text-emerald-600 dark:border-emerald-200">
                          Priority {rule.priority || idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{rule.name}</h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            rule.is_active
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800  border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {rule.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      {rule.description && (
                        <p className="text-[11px] text-slate-500">{rule.description}</p>
                      )}

                      {/* Criteria badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium">When:</span>
                        {rule.criteria.length === 0 ? (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono dark:bg-slate-800 dark:text-slate-300">
                            Any Lead (Catch-all)
                          </span>
                        ) : (
                          rule.criteria.map((c, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-mono dark:bg-emerald-600/40 dark:border-emerald-200 dark:text-emerald-600"
                            >
                              {c.field} {c.operator} &quot;{c.value}&quot;
                            </span>
                          ))
                        )}
                      </div>

                      {/* Assignee badge */}
                      <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-slate-600">
                        <span className="text-slate-400">Route to:</span>
                        {rule.assign_to_type === 'round_robin' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 dark:bg-emerald-600/40 dark:border-emerald-200 dark:text-emerald-600">
                            <RotateCw className="h-3 w-3" /> Round-Robin ({rule.round_robin_user_ids?.length || 0} reps)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                            <UserCheck className="h-3 w-3" />
                            {rule.assigned_user
                              ? `${rule.assigned_user.first_name || ''} ${rule.assigned_user.last_name || ''}`.trim() || rule.assigned_user.email
                              : 'Designated Sales Rep'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasPermission('leads.manage_assignment_rules') && (
                        <>
                          <button
                            type="button"
                            onClick={() => movePriority(idx, 'up')}
                            disabled={idx === 0}
                            title="Increase priority (evaluate earlier)"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePriority(idx, 'down')}
                            disabled={idx === rules.length - 1}
                            title="Decrease priority (evaluate later)"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rule)}
                            className="p-1.5 text-emerald-800 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition dark:hover:bg-slate-800"
                            title="Edit Rule"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleMutation.mutate({ id: rule.id, isActive: !rule.is_active })
                            }
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                              rule.is_active
                                ? 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
                            }`}
                          >
                            {rule.is_active ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(rule.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition dark:hover:bg-slate-800"
                            title="Delete Rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PermissionGate>

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <GitFork className="h-5 w-5 text-emerald-800" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingRuleId ? 'Edit Lead Routing Rule' : 'Create Lead Routing Rule'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 transition dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rule Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Northeast Biotech Inquiries"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority #
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value) || 1)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Optional context for this routing rule"
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              {/* Criteria Builder */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Routing Conditions (ALL must match)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCriteriaRow}
                    className="text-[11px] text-emerald-800 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Condition
                  </button>
                </div>

                <div className="space-y-2">
                  {criteria.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={c.field}
                        onChange={(e) => handleUpdateCriteriaRow(i, 'field', e.target.value)}
                        className="text-xs p-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 w-32"
                      >
                        {CRITERIA_FIELDS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={c.operator}
                        onChange={(e) => handleUpdateCriteriaRow(i, 'operator', e.target.value)}
                        className="text-xs p-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 w-36"
                      >
                        {CRITERIA_OPERATORS.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="Value to match"
                        value={c.value}
                        onChange={(e) => handleUpdateCriteriaRow(i, 'value', e.target.value)}
                        className="text-xs p-2 border border-slate-300 rounded-lg flex-1 bg-white dark:bg-slate-800 dark:border-slate-700"
                      />

                      {criteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCriteriaRow(i)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignment Target */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assignment Target
                </label>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="assignType"
                      checked={assignType === 'user'}
                      onChange={() => setAssignType('user')}
                      className="text-emerald-800"
                    />
                    <span>Single Sales Rep</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="assignType"
                      checked={assignType === 'round_robin'}
                      onChange={() => setAssignType('round_robin')}
                      className="text-emerald-800"
                    />
                    <span>Round-Robin Team</span>
                  </label>
                </div>

                {assignType === 'user' ? (
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="">Select Sales Rep...</option>
                    {(usersQuery.data || []).map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.designation || u.department || u.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Select Reps to rotate in Round-Robin order:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                      {(usersQuery.data || []).map((u: any) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 p-1 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={roundRobinIds.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRoundRobinIds((prev) => [...prev, u.id]);
                              } else {
                                setRoundRobinIds((prev) => prev.filter((x) => x !== u.id));
                              }
                            }}
                            className="rounded-sm border-slate-300 text-emerald-800"
                          />
                          <span className="truncate">
                            {u.first_name} {u.last_name} ({u.designation || 'Rep'})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Notification toggle */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Notify Assigned Rep
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Dispatch an in-app notification when a lead is routed via this rule.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-emerald-800"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={upsertMutation.isPending}
                onClick={() => upsertMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{upsertMutation.isPending ? 'Saving...' : editingRuleId ? 'Save Changes' : 'Create Rule'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
