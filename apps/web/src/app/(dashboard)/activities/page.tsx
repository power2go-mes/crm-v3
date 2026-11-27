'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { TaskCreateModal } from '@/components/tasks/task-create-modal';
import { CallLogModal } from '@/components/calls/call-log-modal';
import { MeetingCreateModal } from '@/components/meetings/meeting-create-modal';
import { useCreateTaskMutation } from '@/hooks/use-tasks';
import { useCreateCallMutation } from '@/hooks/use-calls';
import { useCreateMeetingMutation } from '@/hooks/use-meetings';
import {
  Clock,
  CheckSquare,
  PhoneCall,
  Plus,
  Video,
  Filter,
  CheckCircle2,
  ExternalLink,
  Search,
} from 'lucide-react';
import type { Activity } from '@/types/tasks';

export default function ActivitiesHubPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'task' | 'log_call' | 'meeting'>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);

  const supabase = createClient();
  const queryClient = useQueryClient();

  const createTaskMutation = useCreateTaskMutation();
  const createCallMutation = useCreateCallMutation();
  const createMeetingMutation = useCreateMeetingMutation();

  const { data, isLoading } = useQuery<{ activities: Activity[]; totalCount: number }>({
    queryKey: ['activities-hub', activeTab, search, statusFilter, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select(
          `
          *,
          assigned_to:user_profiles!assigned_to_id(id, first_name, last_name, email),
          created_by:user_profiles!created_by_id(id, first_name, last_name, email)
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('activity_type', activeTab);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
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
        activities: (records || []) as Activity[],
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
      queryClient.invalidateQueries({ queryKey: ['activities-hub'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  const activities = data?.activities || [];
  const totalCount = data?.totalCount || 0;

  const columns: ColumnDef<Activity>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: (act) => {
        let badgeClass = 'bg-slate-100 text-slate-700';
        let icon = <Clock className="w-3.5 h-3.5" />;
        let label = 'Activity';

        if (act.activity_type === 'task') {
          badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
          icon = <CheckSquare className="w-3.5 h-3.5 text-amber-700" />;
          label = 'Task';
        } else if (act.activity_type === 'log_call') {
          badgeClass = 'bg-[#eef2ff] text-[#4361ee] border-indigo-100';
          icon = <PhoneCall className="w-3.5 h-3.5 text-[#4361ee]" />;
          label = 'Call';
        } else if (act.activity_type === 'meeting') {
          badgeClass = 'bg-[#eef2ff] text-[#4361ee] border-indigo-100';
          icon = <Video className="w-3.5 h-3.5 text-[#4361ee]" />;
          label = 'Meeting';
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}`}>
            {icon}
            {label}
          </span>
        );
      },
    },
    {
      id: 'subject',
      header: 'Subject & Description',
      cell: (act) => {
        let detailHref = `/tasks/${act.id}`;
        if (act.activity_type === 'log_call') detailHref = `/calls/${act.id}`;
        if (act.activity_type === 'meeting') detailHref = `/meetings/${act.id}`;

        return (
          <div className="flex flex-col">
            <Link href={detailHref} className="font-semibold text-[#4361ee] hover:text-[#4361ee] hover:underline">
              {act.subject}
            </Link>
            {act.description && (
              <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">{act.description}</span>
            )}
          </div>
        );
      },
      sortable: true,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (act) => {
        const isCompleted = act.status === 'completed' || act.status === 'held';
        return (
          <button
            type="button"
            onClick={() =>
              toggleStatusMutation.mutate({
                id: act.id,
                nextStatus: isCompleted ? 'not_started' : 'completed',
              })
            }
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
              isCompleted
                ? 'bg-[#eef2ff] text-[#4361ee] hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isCompleted ? <CheckCircle2 className="w-3 h-3 text-[#4361ee]" /> : <Clock className="w-3 h-3 text-slate-400" />}
            {act.status ? act.status.replace(/_/g, ' ') : 'Open'}
          </button>
        );
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (act) => {
        const p = act.priority || 'medium';
        let color = 'text-slate-600 bg-slate-100';
        if (p === 'high') color = 'text-rose-700 bg-rose-50 border border-rose-200 font-bold';
        if (p === 'low') color = 'text-slate-500 bg-slate-100';

        return <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${color}`}>{p}</span>;
      },
    },
    {
      id: 'scheduled_time',
      header: 'Due / Scheduled',
      cell: (act) => {
        const time = act.due_date || act.start_time;
        if (!time) return <span className="text-xs text-slate-400">—</span>;
        return <span className="text-xs text-slate-600">{new Date(time).toLocaleDateString()}</span>;
      },
    },
    {
      id: 'assigned_to',
      header: 'Assigned To',
      cell: (act: any) => (
        <span className="text-xs text-slate-600">
          {act.assigned_to ? `${act.assigned_to.first_name} ${act.assigned_to.last_name}` : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: (act) => {
        let detailHref = `/tasks/${act.id}`;
        if (act.activity_type === 'log_call') detailHref = `/calls/${act.id}`;
        if (act.activity_type === 'meeting') detailHref = `/meetings/${act.id}`;

        return (
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
          >
            <ExternalLink className="w-3 h-3" />
            View
          </Link>
        );
      },
    },
  ];

  return (
    <PageContainer>
      <PermissionGate action="tasks.view" showAccessDenied>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activities Hub</h1>
              <p className="text-sm text-slate-500 mt-1">
                Unified workspace managing all tasks, outbound/inbound call logs, and customer meetings
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCallModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#4361ee]" />
                Log Call
              </button>
              <button
                type="button"
                onClick={() => setIsMeetingModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition"
              >
                <Video className="w-3.5 h-3.5 text-[#4361ee]" />
                Schedule Meeting
              </button>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#4361ee] hover:bg-[#3a5bf0] rounded-lg shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>
            </div>
          </div>

          {/* Type Tabs */}
          <div className="border-b border-slate-200 flex items-center gap-6">
            <button
              type="button"
              onClick={() => { setActiveTab('all'); setPage(1); }}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                activeTab === 'all'
                  ? 'border-[#4361ee] text-[#4361ee] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              All Activities
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('task'); setPage(1); }}
              className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
                activeTab === 'task'
                  ? 'border-[#4361ee] text-[#4361ee] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Tasks
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('log_call'); setPage(1); }}
              className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
                activeTab === 'log_call'
                  ? 'border-[#4361ee] text-[#4361ee] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              Calls
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('meeting'); setPage(1); }}
              className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
                activeTab === 'meeting'
                  ? 'border-[#4361ee] text-[#4361ee] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Video className="w-4 h-4" />
              Meetings
            </button>
          </div>

          {/* DataGrid */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4361ee]"
                >
                  <option value="all">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="planned">Planned (Meetings)</option>
                  <option value="held">Held (Meetings)</option>
                </select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search activities by subject..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4361ee]"
                />
              </div>
            </div>

            <DataGrid
              data={activities}
              columns={columns}
              keyExtractor={(act) => act.id}
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

        {/* Modals */}
        <TaskCreateModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSubmit={async (payload) => {
            await createTaskMutation.mutateAsync(payload);
          }}
        />
        <CallLogModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          onSubmit={async (payload) => {
            await createCallMutation.mutateAsync(payload);
          }}
        />
        <MeetingCreateModal
          isOpen={isMeetingModalOpen}
          onClose={() => setIsMeetingModalOpen(false)}
          onSubmit={async (payload) => {
            await createMeetingMutation.mutateAsync(payload);
          }}
        />
      </PermissionGate>
    </PageContainer>
  );
}
