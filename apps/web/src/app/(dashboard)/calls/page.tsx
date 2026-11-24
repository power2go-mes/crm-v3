'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { CallLogModal } from '@/components/calls/call-log-modal';
import { CallEditModal } from '@/components/calls/call-edit-modal';
import { CallDetailModal } from '@/components/calls/call-detail-modal';
import {
  useCalls,
  useCreateCallMutation,
  useUpdateCallMutation,
  useDeleteCallMutation,
} from '@/hooks/use-calls';
import type { CallWithRelations } from '@/types/calls';
import { CALL_TYPES, CALL_STATUSES } from '@/types/calls';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Calendar,
  User,
  Edit2,
  Trash2,
  Eye,
} from 'lucide-react';

export default function CallsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<CallWithRelations | null>(null);
  const [viewingCall, setViewingCall] = useState<CallWithRelations | null>(null);

  // Queries & Mutations
  const { data, isLoading } = useCalls({
    page,
    pageSize,
    search: searchTerm,
    callType: selectedType,
    status: selectedStatus,
    sortBy,
    sortOrder,
  });

  const createMutation = useCreateCallMutation();
  const updateMutation = useUpdateCallMutation();
  const deleteMutation = useDeleteCallMutation();

  const calls = data?.calls || [];
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
    setSelectedIds(all ? calls.map((c) => c.id) : []);
  };

  const handleDeleteSingle = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this call log?')) {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} call log(s)?`)) {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selected = calls.filter((c) => selectedIds.includes(c.id));
    const headers = ['Subject', 'Direction', 'Duration (Min)', 'Status', 'Date', 'Caller'];
    const rows = selected.map((c) => [
      c.subject || '',
      c.call_type || '',
      String(c.call_duration_minutes ?? ''),
      c.status || '',
      c.start_time || c.created_at || '',
      c.assigned_to?.first_name ? `${c.assigned_to.first_name} ${c.assigned_to.last_name}` : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `calls_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<CallWithRelations>[] = [
    {
      id: 'subject',
      header: 'Call Subject',
      sortable: true,
      accessorKey: 'subject',
      cell: (c) => (
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 p-1 rounded bg-slate-800 text-emerald-600">
            {c.call_type === 'inbound' ? (
              <PhoneIncoming className="h-3.5 w-3.5" />
            ) : (
              <PhoneOutgoing className="h-3.5 w-3.5" />
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => setViewingCall(c)}
              className="font-semibold text-slate-100 hover:text-emerald-600 text-left transition"
            >
              {c.subject}
            </button>
            {c.description && (
              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{c.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'call_type',
      header: 'Direction',
      sortable: true,
      accessorKey: 'call_type',
      width: '120px',
      cell: (c) => {
        const conf = CALL_TYPES.find((t) => t.value === c.call_type) || CALL_TYPES[0];
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${conf.color}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      id: 'duration',
      header: 'Duration',
      width: '100px',
      cell: (c) => (
        <span className="text-xs text-slate-300 flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          {c.call_duration_minutes !== null ? `${c.call_duration_minutes}m` : '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Outcome / Status',
      sortable: true,
      accessorKey: 'status',
      width: '140px',
      cell: (c) => {
        const conf = CALL_STATUSES.find((s) => s.value === c.status) || CALL_STATUSES[0];
        return (
          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${conf.color}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      id: 'start_time',
      header: 'Call Time',
      sortable: true,
      accessorKey: 'start_time',
      width: '160px',
      cell: (c) => {
        const d = c.start_time || c.created_at;
        return d ? (
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            {new Date(d).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        );
      },
    },
    {
      id: 'assigned_to',
      header: 'Caller',
      cell: (c) =>
        c.assigned_to ? (
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-500" />
            {c.assigned_to.first_name} {c.assigned_to.last_name}
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
      cell: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setViewingCall(c)}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-600 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditingCall(c)}
            title="Edit Call"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteSingle(c.id)}
            title="Delete Call"
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
      <PermissionGate action="calls.view" showAccessDenied>
        <div className="space-y-4">
          {/* Header & Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600/10 text-emerald-600 rounded-xl border border-emerald-200/20">
                  <PhoneCall className="h-6 w-6" />
                </div>
                Calls & Customer Communications
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Log and monitor outbound sales calls, inbound customer inquiries, and conversation outcomes.
              </p>
            </div>

            {/* Direction Filter Pills */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedType === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Calls
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('outbound')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedType === 'outbound' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Outbound
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('inbound')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedType === 'inbound' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Inbound
              </button>
            </div>
          </div>

          <ListToolbar
            searchPlaceholder="Search calls by subject or notes..."
            onSearchChange={setSearchTerm}
            onFilterToggle={() => {}}
            isFilterOpen={false}
            activeFilterCount={0}
            onNewClick={() => setIsLogModalOpen(true)}
            newButtonLabel="Log Call"
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
            data={calls}
            keyExtractor={(c) => c.id}
            selectedIds={selectedIds}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            onRowClick={(c) => setViewingCall(c)}
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
      <CallLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      {editingCall && (
        <CallEditModal
          isOpen={!!editingCall}
          onClose={() => setEditingCall(null)}
          call={editingCall}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: editingCall.id, updates });
          }}
        />
      )}

      {viewingCall && (
        <CallDetailModal
          isOpen={!!viewingCall}
          onClose={() => setViewingCall(null)}
          call={viewingCall}
          onEdit={(c) => setEditingCall(c)}
          onDelete={async (id) => {
            await deleteMutation.mutateAsync(id);
          }}
        />
      )}
    </PageContainer>
  );
}
