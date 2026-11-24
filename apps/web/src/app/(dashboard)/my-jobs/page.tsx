'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useAuth } from '@/components/providers/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { TaskCreateModal } from '@/components/tasks/task-create-modal';
import { useCreateTaskMutation } from '@/hooks/use-tasks';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Plus,
  ExternalLink,
  Search,
} from 'lucide-react';
import type { Activity } from '@/types/tasks';

export default function MyJobsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('pending');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const supabase = createClient();
  const queryClient = useQueryClient();
  const createTaskMutation = useCreateTaskMutation();

  const userId = user?.id;

  const { data, isLoading } = useQuery<{ jobs: Activity[]; totalCount: number }>({
    queryKey: ['my-jobs', userId, search, filter, page, pageSize],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select('*', { count: 'exact' })
        .eq('assigned_to_id', userId!)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (filter === 'pending') {
        query = query.neq('status', 'completed');
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      } else if (filter === 'overdue') {
        const now = new Date().toISOString();
        query = query.neq('status', 'completed').lt('due_date', now);
      }

      if (search) {
        query = query.ilike('subject', `%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: records, error, count } = await query;
      if (error) throw error;

      return {
        jobs: (records || []) as Activity[],
        totalCount: count || 0,
      };
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: string }) => {
      const { error } = await supabase.from('activities').update({ status: nextStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['activities-hub'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const jobs = data?.jobs || [];
  const totalCount = data?.totalCount || 0;

  const columns: ColumnDef<Activity>[] = [
    {
      id: 'status_check',
      header: 'Complete',
      cell: (job) => {
        const isDone = job.status === 'completed';
        return (
          <button
            type="button"
            onClick={() =>
              toggleStatusMutation.mutate({
                id: job.id,
                nextStatus: isDone ? 'not_started' : 'completed',
              })
            }
            className={`p-1.5 rounded-lg transition ${
              isDone
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-slate-200'
            }`}
            title={isDone ? 'Mark as Not Started' : 'Mark as Completed'}
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        );
      },
    },
    {
      id: 'subject',
      header: 'Assigned Job / Task',
      cell: (job) => {
        const isDone = job.status === 'completed';
        return (
          <div className="flex flex-col">
            <Link
              href={`/tasks/${job.id}`}
              className={`font-semibold hover:underline ${
                isDone ? 'line-through text-slate-400' : 'text-emerald-800 hover:text-emerald-800'
              }`}
            >
              {job.subject}
            </Link>
            {job.description && (
              <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">{job.description}</span>
            )}
          </div>
        );
      },
      sortable: true,
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (job) => {
        const p = job.priority || 'medium';
        let color = 'text-slate-600 bg-slate-100';
        if (p === 'high') color = 'text-rose-700 bg-rose-50 border border-rose-200 font-bold';
        if (p === 'low') color = 'text-slate-500 bg-slate-100';

        return <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${color}`}>{p}</span>;
      },
      sortable: true,
    },
    {
      id: 'due_date',
      header: 'Deadline',
      cell: (job) => {
        if (!job.due_date) return <span className="text-xs text-slate-400">No deadline</span>;
        const isOverdue = new Date(job.due_date) < new Date() && job.status !== 'completed';
        return (
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
              {new Date(job.due_date).toLocaleDateString()}
            </span>
            {isOverdue && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                Overdue
              </span>
            )}
          </div>
        );
      },
      sortable: true,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (job) => (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
          {job.status ? job.status.replace(/_/g, ' ') : 'Open'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: (job) => (
        <Link
          href={`/tasks/${job.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition"
        >
          <ExternalLink className="w-3 h-3" />
          Open
        </Link>
      ),
    },
  ];

  return (
    <PageContainer>
      <PermissionGate action="tasks.view" showAccessDenied>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Jobs</h1>
              <p className="text-sm text-slate-500 mt-1">
                Your personal work queue: tasks, assigned action items, and operational commitments
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Action Item
              </button>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Tasks</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Direct Resolution</p>
                <p className="text-xs text-slate-500 mt-1">Click the check icon to complete items instantly</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Personal Queue</p>
                <p className="text-xs text-slate-500 mt-1">Filtered strictly to your assigned records</p>
              </div>
            </div>
          </div>

          {/* Filter Bar & DataGrid */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setFilter('pending'); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    filter === 'pending'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Pending Work
                </button>
                <button
                  type="button"
                  onClick={() => { setFilter('overdue'); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    filter === 'overdue'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Overdue
                </button>
                <button
                  type="button"
                  onClick={() => { setFilter('completed'); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    filter === 'completed'
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => { setFilter('all'); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    filter === 'all'
                      ? 'bg-slate-900 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All My Records
              </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search assigned jobs and tasks..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <DataGrid
              data={jobs}
              columns={columns}
              keyExtractor={(job) => job.id}
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
        </div>

        {/* Modal */}
        <TaskCreateModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSubmit={async (payload) => {
            await createTaskMutation.mutateAsync(payload);
          }}
        />
      </PermissionGate>
    </PageContainer>
  );
}
