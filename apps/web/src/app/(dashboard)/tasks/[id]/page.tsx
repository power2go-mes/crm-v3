'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useTask, useUpdateTaskMutation, useDeleteTaskMutation } from '@/hooks/use-tasks';
import { TaskEditModal } from '@/components/tasks/task-edit-modal';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/tasks';
import {
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Link2,
  FileText,
  Edit2,
  Trash2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: task, isLoading, error } = useTask(id);
  const updateMutation = useUpdateTaskMutation();
  const deleteMutation = useDeleteTaskMutation();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleStatusChange = async (nextStatus: string) => {
    if (!task) return;
    await updateMutation.mutateAsync({
      id: task.id,
      updates: { status: nextStatus },
    });
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteMutation.mutateAsync(task.id);
      router.push('/tasks');
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-200" />
        </div>
      </PageContainer>
    );
  }

  if (error || !task) {
    return (
      <PageContainer>
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl">
          <h2 className="text-lg font-bold text-slate-900">Task Not Found</h2>
          <p className="text-xs text-slate-600 mt-1">
            The requested task does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Tasks
          </Link>
        </div>
      </PageContainer>
    );
  }

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
    <PageContainer>
      <PermissionGate action="tasks.view" showAccessDenied>
        <div className="space-y-6">
          {/* Top Bar with Navigation & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/tasks"
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                title="Back to Tasks List"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{task.subject}</h1>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityConfig.color}`}
                  >
                    {priorityConfig.label}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                  {isOverdue && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">Task Detail View</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const nextStatus = task.status === 'completed' ? 'not_started' : 'completed';
                  await handleStatusChange(nextStatus);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                <CheckCircle2
                  className={`h-4 w-4 ${task.status === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}
                />
                {task.status === 'completed' ? 'Mark Incomplete' : 'Mark Completed'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-sm"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Task
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Quick Status Control */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                Current Status:
              </label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs font-medium px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Attributes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs text-slate-600 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5" /> Due Date
                </span>
                <p className="mt-1 font-medium text-slate-800 text-sm">
                  {task.due_date ? (
                    new Date(task.due_date).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  ) : (
                    <span className="text-slate-500">None</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-600 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <User className="h-3.5 w-3.5" /> Assignee
                </span>
                <p className="mt-1 font-medium text-slate-800 text-sm">
                  {task.assigned_to ? (
                    `${task.assigned_to.first_name} ${task.assigned_to.last_name}`
                  ) : (
                    <span className="text-slate-500">Unassigned</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-600 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Link2 className="h-3.5 w-3.5" /> Related Record
                </span>
                <div className="mt-1">
                  {task.related_to_type && task.related_to_id ? (
                    relatedUrl ? (
                      <Link
                        href={relatedUrl}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium underline transition text-sm"
                      >
                        <span className="capitalize">{task.related_to_type}</span> ({task.related_to_id.slice(0, 8)}...)
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-slate-700 text-sm">
                        <span className="capitalize">{task.related_to_type}</span>: {task.related_to_id}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500 text-sm">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-600 flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" /> Created Date
                </span>
                <p className="mt-1 text-slate-700 text-sm">
                  {task.created_at ? new Date(task.created_at).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <span className="text-xs text-slate-600 flex items-center gap-1 font-semibold uppercase tracking-wider mb-2">
                <FileText className="h-3.5 w-3.5" /> Notes & Instructions
              </span>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                {task.description || <span className="text-slate-500 italic">No notes provided.</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {isEditModalOpen && (
          <TaskEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            task={task}
            onSubmit={async (updates) => {
              await updateMutation.mutateAsync({ id: task.id, updates });
              setIsEditModalOpen(false);
            }}
          />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
