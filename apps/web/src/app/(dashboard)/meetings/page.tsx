'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { MeetingCreateModal } from '@/components/meetings/meeting-create-modal';
import { MeetingEditModal } from '@/components/meetings/meeting-edit-modal';
import { MeetingDetailModal } from '@/components/meetings/meeting-detail-modal';
import {
  useMeetings,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
  useDeleteMeetingMutation,
} from '@/hooks/use-meetings';
import type { MeetingWithRelations } from '@/types/meetings';
import { MEETING_STATUSES } from '@/types/meetings';
import {
  Calendar,
  Clock,
  User,
  Video,
  MapPin,
  Edit2,
  Trash2,
  Eye,
  ExternalLink,
} from 'lucide-react';

export default function MeetingsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('start_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithRelations | null>(null);
  const [viewingMeeting, setViewingMeeting] = useState<MeetingWithRelations | null>(null);

  // Queries & Mutations
  const { data, isLoading } = useMeetings({
    page,
    pageSize,
    search: searchTerm,
    status: selectedStatus,
    sortBy,
    sortOrder,
  });

  const createMutation = useCreateMeetingMutation();
  const updateMutation = useUpdateMeetingMutation();
  const deleteMutation = useDeleteMeetingMutation();

  const meetings = data?.meetings || [];
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
    setSelectedIds(all ? meetings.map((m) => m.id) : []);
  };

  const handleDeleteSingle = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} meeting(s)?`)) {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selected = meetings.filter((m) => selectedIds.includes(m.id));
    const headers = ['Subject', 'Status', 'Start Time', 'End Time', 'Location/Platform', 'Host'];
    const rows = selected.map((m) => [
      m.subject || '',
      m.status || '',
      m.start_time || '',
      m.end_time || '',
      m.location || m.meeting_url || '',
      m.assigned_to?.first_name ? `${m.assigned_to.first_name} ${m.assigned_to.last_name}` : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `meetings_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<MeetingWithRelations>[] = [
    {
      id: 'subject',
      header: 'Meeting Subject',
      sortable: true,
      accessorKey: 'subject',
      cell: (m) => (
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1 rounded bg-slate-800 text-emerald-600">
            <Video className="h-3.5 w-3.5" />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setViewingMeeting(m)}
              className="font-semibold text-slate-100 hover:text-emerald-600 text-left transition"
            >
              {m.subject}
            </button>
            {m.description && (
              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{m.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'schedule',
      header: 'Date & Time',
      sortable: true,
      accessorKey: 'start_time',
      width: '180px',
      cell: (m) =>
        m.start_time ? (
          <div className="text-xs text-slate-300">
            <div className="flex items-center gap-1 font-medium">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {new Date(m.start_time).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
              <Clock className="h-3 w-3 text-slate-500" />
              {new Date(m.start_time).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {m.end_time && ` - ${new Date(m.end_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Unscheduled</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessorKey: 'status',
      width: '130px',
      cell: (m) => {
        const conf = MEETING_STATUSES.find((s) => s.value === m.status) || MEETING_STATUSES[0];
        return (
          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${conf.color}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      id: 'join_link',
      header: 'Meeting Access',
      width: '130px',
      cell: (m) =>
        m.meeting_url ? (
          <a
            href={m.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 border border-emerald-200/30 text-xs font-semibold transition"
          >
            <Video className="h-3 w-3" /> Join <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-slate-600" />
            {m.location || 'In-Person'}
          </span>
        ),
    },
    {
      id: 'assigned_to',
      header: 'Host',
      cell: (m) =>
        m.assigned_to ? (
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-500" />
            {m.assigned_to.first_name} {m.assigned_to.last_name}
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
      cell: (m) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setViewingMeeting(m)}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-600 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditingMeeting(m)}
            title="Edit Meeting"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteSingle(m.id)}
            title="Delete Meeting"
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
      <PermissionGate action="meetings.view" showAccessDenied>
        <div className="space-y-4">
          {/* Header & Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600/10 text-emerald-600 rounded-xl border border-emerald-200/20">
                  <Calendar className="h-6 w-6" />
                </div>
                Meetings & Product Demonstrations
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Schedule and coordinate client presentations, technical architecture reviews, and follow-ups.
              </p>
            </div>

            {/* Status Pills */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedStatus('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedStatus === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('not_started')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedStatus === 'not_started' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Scheduled
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('completed')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedStatus === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          <ListToolbar
            searchPlaceholder="Search meetings by subject, notes, or location..."
            onSearchChange={setSearchTerm}
            onFilterToggle={() => {}}
            isFilterOpen={false}
            activeFilterCount={0}
            onNewClick={() => setIsCreateModalOpen(true)}
            newButtonLabel="Schedule Meeting"
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
            data={meetings}
            keyExtractor={(m) => m.id}
            selectedIds={selectedIds}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            onRowClick={(m) => setViewingMeeting(m)}
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
      <MeetingCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      {editingMeeting && (
        <MeetingEditModal
          isOpen={!!editingMeeting}
          onClose={() => setEditingMeeting(null)}
          meeting={editingMeeting}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: editingMeeting.id, updates });
          }}
        />
      )}

      {viewingMeeting && (
        <MeetingDetailModal
          isOpen={!!viewingMeeting}
          onClose={() => setViewingMeeting(null)}
          meeting={viewingMeeting}
          onEdit={(m) => setEditingMeeting(m)}
          onDelete={async (id) => {
            await deleteMutation.mutateAsync(id);
          }}
          onStatusChange={async (id, nextStatus) => {
            await updateMutation.mutateAsync({ id, updates: { status: nextStatus } });
            setViewingMeeting((prev) => (prev ? { ...prev, status: nextStatus } : null));
          }}
        />
      )}
    </PageContainer>
  );
}
