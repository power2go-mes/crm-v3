'use client';

import React, { useState } from 'react';
import { X, CheckSquare } from 'lucide-react';
import type { ActivityInsert } from '@/types/tasks';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/tasks';
import { useAuth } from '@/components/providers/auth-provider';
import { useUsers } from '@/hooks/use-users';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<ActivityInsert, 'activity_type'>) => Promise<void>;
  defaultRelatedType?: 'lead' | 'contact' | 'account' | 'opportunity';
  defaultRelatedId?: string;
}

export function TaskCreateModal({
  isOpen,
  onClose,
  onSubmit,
  defaultRelatedType,
  defaultRelatedId,
}: TaskCreateModalProps) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    status: 'not_started',
    assigned_to_id: user?.id || '',
    related_to_type: defaultRelatedType || '',
    related_to_id: defaultRelatedId || '',
    due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      setErrorMsg('Task subject is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        subject: formData.subject.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        assigned_to_id: formData.assigned_to_id || user?.id || null,
        created_by_id: user?.id || null,
        related_to_type: (formData.related_to_type as any) || null,
        related_to_id: formData.related_to_id ? formData.related_to_id.trim() : null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/10 text-emerald-600 rounded-lg">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create New Task</h3>
              <p className="text-xs text-slate-400">Add an operational task or follow-up item.</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g. Follow up on Q4 proposal quote"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Due Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Assignee
              </label>
              <select
                value={formData.assigned_to_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Related Entity Type
              </label>
              <select
                value={formData.related_to_type}
                onChange={(e) => setFormData({ ...formData, related_to_type: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">None (Independent Task)</option>
                <option value="lead">Lead</option>
                <option value="contact">Contact</option>
                <option value="account">Account</option>
                <option value="opportunity">Opportunity</option>
              </select>
            </div>

            {formData.related_to_type && (
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Related Entity ID
                </label>
                <input
                  type="text"
                  value={formData.related_to_id}
                  onChange={(e) => setFormData({ ...formData, related_to_id: e.target.value })}
                  placeholder={`UUID of the related ${formData.related_to_type}`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description / Notes
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add key talking points, objectives, or required deliverables..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
