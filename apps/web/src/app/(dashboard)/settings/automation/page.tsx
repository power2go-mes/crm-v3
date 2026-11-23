'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useAuth } from '@/components/providers/auth-provider';
import { useWorkflowRules, useWorkflowLogs } from '@/hooks/use-automation';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
  Clock,
  ArrowRight,
  Filter,
  Layers,
  Info,
} from 'lucide-react';
import {
  WORKFLOW_TRIGGERS,
  type WorkflowTriggerEvent,
  type WorkflowConditionOperator,
  type WorkflowActionType,
  type CrmWorkflowRule,
} from '@/types/automation';

export default function AutomationSettingsPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

  const { rules, saveRule, toggleRule, deleteRule, isSaving } = useWorkflowRules();
  const { data: logs = [], isLoading: isLogsLoading } = useWorkflowLogs();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<WorkflowTriggerEvent>('opportunity_closed_won');
  const [conditions, setConditions] = useState<{ field: string; operator: WorkflowConditionOperator; value: string }[]>([
    { field: 'amount', operator: 'greater_than', value: '10000' },
  ]);
  const [actionType, setActionType] = useState<WorkflowActionType>('create_task');
  const [actionTitle, setActionTitle] = useState('Executive Follow-Up with Closed Won Customer');
  const [actionPriority, setActionPriority] = useState<'low' | 'medium' | 'high'>('high');

  const handleOpenCreate = () => {
    setRuleName('');
    setRuleDesc('');
    setTriggerEvent('opportunity_closed_won');
    setConditions([{ field: 'amount', operator: 'greater_than', value: '10000' }]);
    setActionType('create_task');
    setActionTitle('Executive Follow-Up with Closed Won Customer');
    setActionPriority('high');
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    await saveRule({
      name: ruleName.trim(),
      description: ruleDesc.trim() || null,
      trigger_event: triggerEvent,
      conditions,
      actions: [
        {
          type: actionType,
          title: actionTitle,
          priority: actionPriority,
        },
      ],
      is_active: true,
      priority: 1,
    });

    setIsModalOpen(false);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Sales Workflow Automation"
        subtitle="Automate repetitive CRM tasks, notification routing, and pipeline hygiene triggers."
        actions={
          hasPermission('automation.manage') ? (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Create Workflow</span>
            </button>
          ) : undefined
        }
      />

      <PermissionGate action="automation.view" showAccessDenied>
        {/* Navigation Tabs */}
        <div className="mb-6 flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>Active Rules ({rules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Execution Audit Logs ({logs.length})</span>
          </button>
        </div>

        {/* Tab 1: Rules */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            {rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <Zap className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-white">No automation rules configured</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Create rules to automate task assignments and notifications based on deal progression.
                </p>
                {hasPermission('automation.manage') && (
                  <button
                    onClick={handleOpenCreate}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Your First Workflow</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs transition sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{rule.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            rule.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {rule.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{rule.description || 'No description provided.'}</p>

                      <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                          <Zap className="h-3 w-3" />
                          WHEN: {rule.trigger_event.replace(/_/g, ' ')}
                        </span>
                        {rule.conditions?.length > 0 && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Filter className="h-3 w-3" />
                            IF: {rule.conditions.map((c: any) => `${c.field} ${c.operator} ${c.value}`).join(', ')}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          <ArrowRight className="h-3 w-3" />
                          THEN: {rule.actions?.map((a: any) => `${a.type} ("${a.title || ''}")`).join(', ')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 sm:mt-0">
                      <button
                        onClick={() => toggleRule({ id: rule.id, is_active: !rule.is_active })}
                        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          rule.is_active
                            ? 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40'
                        }`}
                      >
                        {rule.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        <span>{rule.is_active ? 'Pause' : 'Activate'}</span>
                      </button>

                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Logs */}
        {activeTab === 'logs' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Workflow Execution History
              </h3>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No automation executions recorded yet. Triggers run automatically on qualifying database events.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {log.rule?.name || 'Automation Rule'}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {log.trigger_event}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-500">
                        Record ID: <span className="font-mono">{log.record_id}</span> ({log.record_type})
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        }`}
                      >
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {log.status.toUpperCase()}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.executed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Workflow Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Configure Sales Workflow Rule</h3>

              <form onSubmit={handleSaveRule} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Notify Exec on Big Closed Won Deal"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
                  <input
                    type="text"
                    value={ruleDesc}
                    onChange={(e) => setRuleDesc(e.target.value)}
                    placeholder="Auto-assign onboarding tasks when deal value exceeds $10,000"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    WHEN Trigger Event *
                  </label>
                  <select
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value as WorkflowTriggerEvent)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {WORKFLOW_TRIGGERS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} — {t.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Condition */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    IF Condition Matches:
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={conditions[0]?.field || ''}
                      onChange={(e) =>
                        setConditions([{ ...conditions[0], field: e.target.value } as any])
                      }
                      placeholder="Field (e.g. amount)"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                    <select
                      value={conditions[0]?.operator || 'greater_than'}
                      onChange={(e) =>
                        setConditions([{ ...conditions[0], operator: e.target.value as any }])
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="greater_than">greater than</option>
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                    </select>
                    <input
                      type="text"
                      value={conditions[0]?.value || ''}
                      onChange={(e) =>
                        setConditions([{ ...conditions[0], value: e.target.value } as any])
                      }
                      placeholder="Value"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Action */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    THEN Execute Action:
                  </span>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value as WorkflowActionType)}
                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="create_task">Create Assigned Task</option>
                        <option value="create_notification">Send In-App Notification</option>
                      </select>
                      <select
                        value={actionPriority}
                        onChange={(e) => setActionPriority(e.target.value as any)}
                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="high">Priority: High</option>
                        <option value="medium">Priority: Medium</option>
                        <option value="low">Priority: Low</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={actionTitle}
                      onChange={(e) => setActionTitle(e.target.value)}
                      placeholder="Task subject or alert message"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PermissionGate>
    </PageContainer>
  );
}
