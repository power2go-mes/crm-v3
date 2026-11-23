'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import Link from 'next/link';
import { TaskCreateModal } from '@/components/tasks/task-create-modal';
import { TaskEditModal } from '@/components/tasks/task-edit-modal';
import { TaskDetailModal } from '@/components/tasks/task-detail-modal';
import {
  useTasks,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useToggleTaskStatusMutation,
  useDeleteTaskMutation,
} from '@/hooks/use-tasks';
import type { TaskWithRelations } from '@/types/tasks';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/tasks';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  User,
  Calendar,
  Eye,
} from 'lucide-react';

export default function TasksPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskWithRelations | null>(null);

  // Queries & Mutations
  const { data, isLoading } = useTasks({
    page,
    pageSize,
    search: searchTerm,
    status: selectedStatus,
    sortBy,
    sortOrder,
  });

  const createMutation = useCreateTaskMutation();
  const updateMutation = useUpdateTaskMutation();
  const toggleMutation = useToggleTaskStatusMutation();
  const deleteMutation = useDeleteTaskMutation();

  const tasks = data?.tasks || [];
  const totalCount = data?.totalCount || 0;

  // Handlers
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectRow = (id: string, selected: boolean) => {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const handleSelectAll = (all: boolean) => {
    setSelectedIds(all ? tasks.map((t) => t.id) : []);
  };

  const handleDeleteSingle = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} task(s)?`)) {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selected = tasks.filter((t) => selectedIds.includes(t.id));
    const headers = ['Subject', 'Status', 'Priority', 'Due Date', 'Assigned To'];
    const rows = selected.map((t) => [
      t.subject || '',
      t.status || '',
      t.priority || '',
      t.due_date || '',
      t.assigned_to?.first_name ? `${t.assigned_to.first_name} ${t.assigned_to.last_name}` : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `tasks_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<TaskWithRelations>[] = [
    {
      id: 'subject',
      header: 'Task Subject',
      sortable: true,
      accessorKey: 'subject',
      cell: (t) => (
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMutation.mutateAsync({ id: t.id, currentStatus: t.status });
            }}
            title={t.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
            className="mt-0.5 text-slate-400 hover:text-emerald-400 transition"
          >
            {t.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-emerald-500/20" />
            ) : (
              <div className="h-4 w-4 rounded border border-slate-600 hover:border-emerald-400" />
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => setViewingTask(t)}
              className={`font-semibold hover:text-blue-400 text-left transition ${
                t.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-100'
              }`}
            >
              {t.subject}
            </button>
            {t.description && (
              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      sortable: true,
      accessorKey: 'priority',
      width: '110px',
      cell: (t) => {
        const conf = TASK_PRIORITIES.find((p) => p.value === t.priority) || TASK_PRIORITIES[1];
        return (
          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${conf.color}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessorKey: 'status',
      width: '140px',
      cell: (t) => {
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              value={t.status}
              onChange={(e) => updateMutation.mutateAsync({ id: t.id, updates: { status: e.target.value } })}
              className="text-[11px] font-medium px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        );
      },
    },
    {
      id: 'due_date',
      header: 'Due Date',
      sortable: true,
      accessorKey: 'due_date',
      width: '160px',
      cell: (t) =>
        t.due_date ? (
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            {new Date(t.due_date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : (
          <span className="text-xs text-slate-500">No due date</span>
        ),
    },
    {
      id: 'assigned_to',
      header: 'Assigned To',
      cell: (t) =>
        t.assigned_to ? (
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-500" />
            {t.assigned_to.first_name} {t.assigned_to.last_name}
          </span>
        ) : (
          <span className="text-xs text-slate-500">Unassigned</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      width: '90px',
      className: 'text-right',
      cell: (t) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setViewingTask(t)}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditingTask(t)}
            title="Edit Task"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteSingle(t.id)}
            title="Delete Task"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PermissionGate action="tasks.view" showAccessDenied>
        <div className="space-y-4">
          {/* Header & Status Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <CheckSquare className="h-6 w-6 text-blue-500" />
                <span>Tasks & Follow-ups</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Manage operational action items, daily sales outreach, and scheduled reminders.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
              {[
                { id: 'all', label: 'All Tasks' },
                { id: 'not_started', label: 'Not Started' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'completed', label: 'Completed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    selectedStatus === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <ListToolbar
            searchPlaceholder="Search tasks by subject or notes..."
            onSearchChange={setSearchTerm}
            onFilterToggle={() => {}}
            isFilterOpen={false}
            activeFilterCount={0}
            onNewClick={() => setIsCreateModalOpen(true)}
            newButtonLabel="New Task"
            canCreate={true}
          />

          <BulkActionBar
            selectedCount={selectedIds.length}
            totalCount={totalCount}
            onSelectAll={() => handleSelectAll(true)}
            onClearSelection={() => setSelectedIds([])}
            onBulkDelete={handleBulkDelete}
            onExportSelected={handleExportSelected}
          />

          <DataGrid
            columns={columns}
            data={tasks}
            keyExtractor={(t) => t.id}
            selectedIds={selectedIds}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            onRowClick={(t) => setViewingTask(t)}
            sortField={sortBy}
            sortDirection={sortOrder}
            onSort={handleSort}
            isLoading={isLoading}
          />

          <PaginationBar
            currentPage={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      </PermissionGate>

      {/* Modals */}
      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      {editingTask && (
        <TaskEditModal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: editingTask.id, updates });
          }}
        />
      )}

      {viewingTask && (
        <TaskDetailModal
          isOpen={!!viewingTask}
          onClose={() => setViewingTask(null)}
          task={viewingTask}
          onEdit={(task) => setEditingTask(task)}
          onDelete={async (id) => {
            await deleteMutation.mutateAsync(id);
          }}
          onStatusChange={async (id, nextStatus) => {
            await updateMutation.mutateAsync({ id, updates: { status: nextStatus } });
            setViewingTask((prev) => (prev ? { ...prev, status: nextStatus } : null));
          }}
        />
      )}
    </PageContainer>
  );
}
