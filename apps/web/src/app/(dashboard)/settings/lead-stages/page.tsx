'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  useLeadStages,
  useUpdateLeadStageMutation,
  useReorderLeadStagesMutation,
  type LeadStage,
} from '@/hooks/use-lead-stages';
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Edit2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Percent,
  Palette,
  X,
  Save,
} from 'lucide-react';

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#059669', // dark green
  '#6366f1', // indigo
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
];

export default function LeadStagesPage() {
  const { data: stages = [], isLoading, error } = useLeadStages();
  const updateMutation = useUpdateLeadStageMutation();
  const reorderMutation = useReorderLeadStagesMutation();

  const [editingStage, setEditingStage] = useState<LeadStage | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [probability, setProbability] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openEditModal = (stage: LeadStage) => {
    setEditingStage(stage);
    setName(stage.name);
    setColor(stage.color || '#3b82f6');
    setProbability(Number(stage.probability) || 0);
    setErrorMessage(null);
  };

  const closeEditModal = () => {
    setEditingStage(null);
    setErrorMessage(null);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage) return;

    if (!name.trim()) {
      setErrorMessage('Stage name cannot be empty.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        stageId: editingStage.id,
        name: name.trim(),
        color: color.trim(),
        probability: Number(probability),
      });

      setSuccessMessage(`Stage "${name}" updated successfully.`);
      closeEditModal();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update lead stage.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (stages.length <= 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const [moved] = newStages.splice(index, 1);
    newStages.splice(targetIndex, 0, moved);

    try {
      await reorderMutation.mutateAsync(newStages.map((s) => s.id));
      setSuccessMessage('Lead pipeline stage sequence updated.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reorder stages.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-2 text-xs">
        <Link href="/settings" className="text-slate-500 hover:text-emerald-800 transition flex items-center gap-1">
          <span>Settings</span>
          <span>›</span>
          <span className="text-emerald-800 font-medium">Lead Stage Configuration</span>
        </Link>
      </div>

      <PageHeader
        title="Lead Pipeline Stages"
        subtitle="Manage the 6-stage lead lifecycle (New, Contacted, Qualified, Proposal, Lost, Convert) and probability pacing."
        actions={
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Settings</span>
          </Link>
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
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-800" />
              <span>Configured Pipeline Stages ({stages.length})</span>
            </div>
            <span className="text-[11px] normal-case font-normal text-slate-400">
              System protected core lifecycle
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading lead pipeline stages...</div>
          ) : stages.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No lead pipeline stages found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 uppercase tracking-wider /50">
                    <th className="py-3 px-4 text-left font-semibold w-16">Seq</th>
                    <th className="py-3 px-4 text-left font-semibold">Stage Name</th>
                    <th className="py-3 px-4 text-left font-semibold">Color</th>
                    <th className="py-3 px-4 text-left font-semibold">Probability</th>
                    <th className="py-3 px-4 text-left font-semibold">Stage Type</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stages.map((stage, idx) => (
                    <tr key={stage.id} className="hover:bg-slate-50/60 transition dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-500">
                        #{stage.order_index}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: stage.color || '#3b82f6' }}
                          />
                          <span>{stage.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({stage.id})</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {stage.color}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{stage.probability}%</span>
                          <div className="w-12 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${Math.min(Number(stage.probability), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {stage.is_final ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            Conversion Stage
                          </span>
                        ) : stage.id === 'lost' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            Closed Lost
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Pipeline Stage
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <PermissionGate action="leads.manage_stages">
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'up')}
                              disabled={idx === 0 || reorderMutation.isPending}
                              title="Move stage up"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'down')}
                              disabled={idx === stages.length - 1 || reorderMutation.isPending}
                              title="Move stage down"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(stage)}
                              title="Edit stage properties"
                              className="p-1 text-emerald-800 hover:text-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-slate-800 ml-1"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Stage Modal */}
        {editingStage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4 text-emerald-800" />
                  <h3 className="font-semibold text-sm text-slate-900">
                    Edit Lead Stage ({editingStage.id})
                  </h3>
                </div>
                <button
                  onClick={closeEditModal}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveStage} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Stage Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Conversion Probability (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={probability}
                      onChange={(e) => setProbability(Number(e.target.value))}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="w-12 text-right font-mono font-bold text-xs text-emerald-800 dark:text-emerald-600">
                      {probability}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Color
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-6 h-6 rounded-lg border border-slate-300 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#3b82f6"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-md border transition ${
                          color === c ? 'ring-2 ring-blue-500 ring-offset-1 border-white' : 'border-black/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 /60 rounded-xl text-[11px] text-slate-500 flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>
                    Core system identifier <code className="font-mono text-slate-700 dark:text-slate-300">{editingStage.id}</code> is locked to preserve lead conversion workflows, audit history, and reporting calculations.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
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
