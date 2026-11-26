'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageContainer } from '@/components/shell/page-container';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { CampaignForm } from '@/components/campaigns/campaign-form';
import { CampaignFilterPanel } from '@/components/campaigns/campaign-filter-panel';
import { CampaignChartView } from '@/components/campaigns/campaign-chart-view';
import { CampaignSplitView } from '@/components/campaigns/campaign-split-view';
import { CampaignKanbanBoard } from '@/components/campaigns/campaign-kanban-board';
import type { ViewMode } from '@/types/leads';
import {
  useCampaignsList,
  useDeleteCampaignMutation,
  useBulkDeleteCampaignsMutation,
} from '@/hooks/use-campaigns';
import type {
  CampaignWithRelations,
  CampaignFilterState,
  CampaignRecord,
} from '@/types/campaigns';
import {
  Megaphone,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const defaultFilters: CampaignFilterState = {
  status: [],
  campaignType: [],
  startDateFrom: null,
  startDateTo: null,
  endDateFrom: null,
  endDateTo: null,
  minExpectedRevenue: null,
  maxExpectedRevenue: null,
  minBudgetCost: null,
  maxBudgetCost: null,
};

export default function CampaignsPage() {
  const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<CampaignFilterState>(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignRecord | null | undefined>(undefined);

  // Queries & Mutations
  const { data, isLoading, refetch, isError } = useCampaignsList({
    page,
    pageSize,
    search: searchTerm,
    sortBy,
    sortOrder,
    filters,
    viewType,
  });

  const deleteMutation = useDeleteCampaignMutation();
  const bulkDeleteMutation = useBulkDeleteCampaignsMutation();

  const campaigns = data?.campaigns || [];
  const totalCount = data?.totalCount || 0;

  // Sorting
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Selection
  const handleSelectRow = (id: string, selected: boolean) => {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const handleSelectAll = (all: boolean) => {
    setSelectedIds(all ? campaigns.map((c) => c.id) : []);
  };

  // Deletion
  const handleDeleteSingle = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} campaign(s)?`)) {
      await bulkDeleteMutation.mutateAsync(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selected = campaigns.filter((c) => selectedIds.includes(c.id));
    const headers = ['Campaign Name', 'Type', 'Status', 'Active', 'Expected Revenue', 'Budget Cost', 'Start Date', 'End Date'];
    const rows = selected.map((c) => [
      c.campaign_name || '',
      c.campaign_type || '',
      c.status || '',
      c.status === 'in_progress' || c.status === 'planned' ? 'Yes' : 'No',
      c.expected_revenue || '',
      c.budget_cost || '',
      c.start_date || '',
      c.end_date || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `campaigns_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeFilterCount =
    filters.status.length +
    filters.campaignType.length +
    (filters.startDateFrom ? 1 : 0) +
    (filters.startDateTo ? 1 : 0) +
    (filters.endDateFrom ? 1 : 0) +
    (filters.endDateTo ? 1 : 0) +
    (filters.minExpectedRevenue != null ? 1 : 0) +
    (filters.maxExpectedRevenue != null ? 1 : 0);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Completed</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">In Progress</span>;
      case 'planned':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800">Planned</span>;
      case 'aborted':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Aborted</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">{status || 'New'}</span>;
    }
  };

  const columns: ColumnDef<CampaignWithRelations>[] = [
    {
      id: 'campaign_name',
      header: 'Campaign Name',
      sortable: true,
      accessorKey: 'campaign_name',
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">
            <Megaphone className="h-4 w-4" />
          </div>
          <Link
            href={`/campaigns/${c.id}`}
            className="font-medium text-slate-900 hover:text-emerald-800 transition"
          >
            {c.campaign_name}
          </Link>
        </div>
      ),
    },
    {
      id: 'campaign_type',
      header: 'Type',
      sortable: true,
      accessorKey: 'campaign_type',
      cell: (c) => <span className="capitalize text-slate-700">{c.campaign_type?.replace(/_/g, ' ') || '—'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessorKey: 'status',
      cell: (c) => getStatusBadge(c.status),
    },
    {
      id: 'active_status',
      header: 'Active',
      sortable: true,
      cell: (c) =>
        c.status === 'in_progress' || c.status === 'planned' ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Yes
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
            <XCircle className="h-3.5 w-3.5" /> No
          </span>
        ),
    },
    {
      id: 'expected_revenue',
      header: 'Expected Revenue',
      sortable: true,
      accessorKey: 'expected_revenue',
      cell: (c) => (
        <div className="font-semibold text-slate-800">
          {c.expected_revenue != null ? (
            `$${Number(c.expected_revenue).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}`
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'budget_cost',
      header: 'Budget Cost',
      sortable: true,
      accessorKey: 'budget_cost',
      cell: (c) => (
        <div className="text-slate-700">
          {c.budget_cost != null ? (
            `$${Number(c.budget_cost).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}`
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'dates',
      header: 'Timeline',
      cell: (c) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {c.start_date || '—'} {c.end_date ? `→ ${c.end_date}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      width: '80px',
      className: 'text-right',
      cell: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/campaigns/${c.id}`}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>

          <PermissionGate action="campaigns.update">
            <button
              type="button"
              title="Edit Campaign"
              onClick={() => setEditingCampaign(c as unknown as CampaignRecord)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-emerald-800 transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>

          <PermissionGate action="campaigns.delete">
            <button
              type="button"
              title="Delete Campaign"
              onClick={() => handleDeleteSingle(c.id)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="full">
      <PermissionGate action="campaigns.view" showAccessDenied>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <ListToolbar
              title="Campaigns"
              subtitle="Plan marketing initiatives, track budgets, and evaluate campaign ROI."
              viewType={viewType}
              onViewTypeChange={(type) => {
                setViewType(type);
                setSelectedIds([]);
                setPage(1);
              }}
              viewMode={viewMode}
              showLeadViews={true}
              showKanban={true}
              onViewModeChange={setViewMode}
              searchValue={searchTerm}
              onSearchChange={(val) => {
                setSearchTerm(val);
                setPage(1);
              }}
              onReload={() => refetch()}
              onFilterToggle={() => setIsFilterPanelOpen((prev) => !prev)}
              isFilterOpen={isFilterPanelOpen}
              activeFilterCount={activeFilterCount}
              onNewClick={() => setEditingCampaign(null)}
              newButtonLabel="+ New Campaign"
              canCreate={hasPermission('campaigns.create')}
            />
          </div>

          <BulkActionBar
            selectedCount={selectedIds.length}
            totalCount={totalCount}
            onSelectAll={() => handleSelectAll(true)}
            onClearSelection={() => setSelectedIds([])}
            onBulkDelete={handleBulkDelete}
            onExportSelected={handleExportSelected}
            canDelete={hasPermission('campaigns.delete')}
          />

          {isError && (
            <p role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
              Campaigns could not be loaded. Please retry.
            </p>
          )}

          {viewMode === 'table' && (
            <>
              <DataGrid
                columns={columns}
                data={campaigns}
                keyExtractor={(c) => c.id}
                selectedIds={selectedIds}
                onSelectRow={handleSelectRow}
                onSelectAll={handleSelectAll}
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
            </>
          )}

          {viewMode === 'card' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {campaigns.map((c) => (
                  <article key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/campaigns/${c.id}`} className="text-base font-semibold text-slate-900 hover:text-emerald-800 transition truncate">
                        {c.campaign_name}
                      </Link>
                      {getStatusBadge(c.status)}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span className="capitalize">{c.campaign_type?.replace(/_/g, ' ') || 'General'}</span>
                      <span>
                        {c.start_date || '—'} {c.end_date ? `→ ${c.end_date}` : ''}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Exp. Revenue</span>
                        <span className="font-semibold text-emerald-600 text-sm">
                          ${Number(c.expected_revenue || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Budget</span>
                        <span className="font-semibold text-slate-700 text-sm">
                          ${Number(c.budget_cost || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-3 text-sm">
                      <Link href={`/campaigns/${c.id}`} className="text-emerald-800 hover:text-emerald-800 font-medium">
                        View
                      </Link>
                      {hasPermission('campaigns.update') && (
                        <button
                          type="button"
                          onClick={() => setEditingCampaign(c as unknown as CampaignRecord)}
                          className="text-emerald-800 hover:text-emerald-800 font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!isLoading && campaigns.length === 0 && (
                <p className="rounded-xl bg-white p-8 text-center text-slate-500">No campaigns found.</p>
              )}
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
            </>
          )}

          {viewMode === 'kanban' && (
            <CampaignKanbanBoard
              campaigns={campaigns}
              isLoading={isLoading}
            />
          )}

          {viewMode === 'split' && (
            <CampaignSplitView
              campaigns={campaigns}
              isLoading={isLoading}
              onEditCampaign={(c) => setEditingCampaign(c)}
            />
          )}

          {viewMode === 'chart' && (
            <CampaignChartView filters={filters} search={searchTerm} />
          )}
        </div>
      </PermissionGate>

      {/* Campaign Filter Drawer */}
      <CampaignFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onApplyFilters={(f) => {
          setFilters(f);
          setPage(1);
        }}
        onResetFilters={() => {
          setFilters(defaultFilters);
          setPage(1);
        }}
      />

      {/* Campaign Form Modal */}
      {editingCampaign !== undefined && (
        <CampaignForm
          record={editingCampaign ?? undefined}
          parents={campaigns as unknown as CampaignRecord[]}
          onClose={() => setEditingCampaign(undefined)}
          onSaved={async () => {
            setEditingCampaign(undefined);
            await refetch();
          }}
        />
      )}
    </PageContainer>
  );
}
