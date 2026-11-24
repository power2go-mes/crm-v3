'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  CheckCircle2,
  Calendar,
  User,
  Clock,
  Link2,
  FileText,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import type { TaskWithRelations } from '@/types/tasks';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/tasks';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskWithRelations | null;
  onEdit: (task: TaskWithRelations) => void;
  onDelete: (id: string) => Promise<void>;
  onStatusChange: (id: string, nextStatus: string) => Promise<void>;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskDetailModalProps) {
  if (!isOpen || !task) return null;

  const priorityConfig =
    TASK_PRIORITIES.find((p) => p.value === task.priority) || TASK_PRIORITIES[1];
  const statusConfig =
    TASK_STATUSES.find((s) => s.value === task.status) || TASK_STATUSES[0];

  const getRelatedLink = () => {
    if (!task.related_to_type || !task.related_to_id) return null;
    const type = task.related_to_type.toLowerCase();
    switch (type) {
      case 'lead':
        return `/leads/${task.related_to_id}`;
      case 'contact':
        return `/contacts/${task.related_to_id}`;
      case 'account':
        return `/accounts/${task.related_to_id}`;
      case 'opportunity':
        return `/opportunities/${task.related_to_id}`;
      default:
        return null;
    }
  };

  const relatedUrl = getRelatedLink();

  const isOverdue =
    task.due_date &&
    task.status !== 'completed' &&
    task.status !== 'cancelled' &&
    new Date(task.due_date).getTime() < Date.now();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${priorityConfig.color}`}
            >
              {priorityConfig.label} Priority
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${statusConfig.color}`}
            >
              {statusConfig.label}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(task);
              }}
              title="Edit Task"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this task?')) {
                  await onDelete(task.id);
                  onClose();
                }
              }}
              title="Delete Task"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Title & Subject */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{task.subject}</h2>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Change Status:
              </label>
              <select
                value={task.status}
                onChange={(e) => onStatusChange(task.id, e.target.value)}
                className="text-xs font-medium px-2.5 py-1 bg-white border border-slate-300 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            {/* Due Date */}
            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" /> Due Date
              </span>
              <p className="mt-1 font-medium text-slate-200">
                {task.due_date ? (
                  new Date(task.due_date).toLocaleString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                ) : (
                  <span className="text-slate-500">No deadline set</span>
                )}
              </p>
            </div>

            {/* Assignee */}
            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <User className="h-3.5 w-3.5" /> Assigned To
              </span>
              <p className="mt-1 font-medium text-slate-200">
                {task.assigned_to ? (
                  `${task.assigned_to.first_name} ${task.assigned_to.last_name} (${task.assigned_to.email})`
                ) : (
                  <span className="text-slate-500">Unassigned</span>
                )}
              </p>
            </div>

            {/* Related Entity */}
            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <Link2 className="h-3.5 w-3.5" /> Related Record
              </span>
              <div className="mt-1">
                {task.related_to_type && task.related_to_id ? (
                  relatedUrl ? (
                    <Link
                      href={relatedUrl}
                      className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-600 font-medium underline transition"
                    >
                      <span className="capitalize">{task.related_to_type}</span> ({task.related_to_id.slice(0, 8)}...)
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-slate-300">
                      <span className="capitalize">{task.related_to_type}</span>: {task.related_to_id}
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">None (Standalone Task)</span>
                )}
              </div>
            </div>

            {/* Created By */}
            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" /> Created On
              </span>
              <p className="mt-1 text-xs text-slate-300">
                {task.created_at ? new Date(task.created_at).toLocaleString() : '—'}
                {task.created_by && ` by ${task.created_by.first_name} ${task.created_by.last_name}`}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider mb-2">
              <FileText className="h-3.5 w-3.5" /> Description & Notes
            </span>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
              {task.description || <span className="text-slate-500 italic">No description provided.</span>}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={async () => {
              const nextStatus = task.status === 'completed' ? 'not_started' : 'completed';
              await onStatusChange(task.id, nextStatus);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <CheckCircle2
              className={`h-4 w-4 ${task.status === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}
            />
            {task.status === 'completed' ? 'Mark as Incomplete' : 'Mark as Completed'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
