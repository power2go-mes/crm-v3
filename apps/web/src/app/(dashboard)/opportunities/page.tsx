'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { OpportunityStageBadge } from '@/components/opportunities/opportunity-stage-badge';
import { OpportunityKanbanBoard } from '@/components/opportunities/opportunity-kanban-board';
import { OpportunityFilterPanel } from '@/components/opportunities/opportunity-filter-panel';
import { OpportunityCreateModal } from '@/components/opportunities/opportunity-create-modal';
import { OpportunityEditModal } from '@/components/opportunities/opportunity-edit-modal';
import { OpportunityChartView } from '@/components/opportunities/opportunity-chart-view';
import { OpportunitySplitView } from '@/components/opportunities/opportunity-split-view';
import {
  useOpportunities,
  useCreateOpportunityMutation,
  useUpdateOpportunityMutation,
  useDeleteOpportunityMutation,
} from '@/hooks/use-opportunities';
import type { OpportunityWithRelations, OpportunityFilterState } from '@/types/opportunities';
import type { ViewMode } from '@/types/leads';
import Link from 'next/link';
import {
  TrendingUp,
  Building2,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  User,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

const defaultFilters: OpportunityFilterState = {
  stages: [],
  opportunityTypes: [],
  leadSources: [],
  ownerId: null,
  closeDateFrom: null,
  closeDateTo: null,
  minAmount: null,
  maxAmount: null,
};

export default function OpportunitiesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<OpportunityFilterState>(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<OpportunityWithRelations | null>(null);

  // Queries & Mutations
  const { data, isLoading, refetch } = useOpportunities({
    page,
    pageSize,
    search: searchTerm,
    sortBy,
    sortOrder,
    filters,
    viewType,
  });

  const createMutation = useCreateOpportunityMutation();
  const updateMutation = useUpdateOpportunityMutation();
  const deleteMutation = useDeleteOpportunityMutation();

  const opportunities = data?.opportunities || [];
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
    setSelectedIds(all ? opportunities.map((o) => o.id) : []);
  };

  // Deletion
  const handleDeleteSingle = async (oppId: string) => {
    if (window.confirm('Are you sure you want to delete this opportunity?')) {
      await deleteMutation.mutateAsync(oppId);
      setSelectedIds((prev) => prev.filter((i) => i !== oppId));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} opportunity(s)?`)) {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedOpps = opportunities.filter((o) => selectedIds.includes(o.id));
    const headers = ['Opportunity Name', 'Account', 'Stage', 'Amount', 'Probability', 'Close Date', 'Created At'];
    const rows = selectedOpps.map((o) => [
      o.name || '',
      o.account?.name || '',
      o.stage || '',
      o.amount || '',
      o.probability || '',
      o.close_date || '',
      o.created_at || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `opportunities_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeFilterCount =
    filters.stages.length +
    filters.opportunityTypes.length +
    filters.leadSources.length +
    (filters.ownerId ? 1 : 0) +
    (filters.closeDateFrom ? 1 : 0) +
    (filters.closeDateTo ? 1 : 0) +
    (filters.minAmount != null ? 1 : 0) +
    (filters.maxAmount != null ? 1 : 0);

  const columns: ColumnDef<OpportunityWithRelations>[] = [
    {
      id: 'name',
      header: 'Opportunity Name',
      sortable: true,
      accessorKey: 'name',
      cell: (opp) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#eef2ff] text-[#4361ee] rounded-xl font-bold shadow-2xs">
            <TrendingUp className="h-4 w-4" />
          </div>
          <Link
            href={`/opportunities/${opp.id}`}
            className="font-bold text-sm text-slate-800 hover:text-[#4361ee] transition"
          >
            {opp.name}
          </Link>
        </div>
      ),
    },
    {
      id: 'account',
      header: 'Account',
      cell: (opp) =>
        opp.account ? (
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <Link
              href={`/accounts/${opp.account.id}`}
              className="hover:text-[#4361ee] transition"
            >
              {opp.account.name}
            </Link>
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      id: 'stage',
      header: 'Pipeline Stage',
      sortable: true,
      accessorKey: 'stage',
      cell: (opp) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <OpportunityStageBadge stage={opp.stage} />
            {opp.is_stalled && (
              <span
                title={`Stalled Deal: ${opp.days_in_stage ?? 14} days in current stage`}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 inline-flex items-center gap-0.5"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Stalled ({opp.days_in_stage ?? 14}d)
              </span>
            )}
          </div>
          {opp.next_step && (
            <p className="text-[11px] text-slate-500 truncate max-w-[200px]" title={opp.next_step}>
              Next: {opp.next_step}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      accessorKey: 'amount',
      cell: (opp) => (
        <div className="font-semibold text-slate-800">
          {opp.amount != null ? (
            `$${Number(opp.amount).toLocaleString(undefined, {
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
      id: 'probability',
      header: 'Probability',
      sortable: true,
      accessorKey: 'probability',
      cell: (opp) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#4361ee] h-full rounded-full transition-all"
              style={{ width: `${opp.probability || 0}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-600">{opp.probability || 0}%</span>
        </div>
      ),
    },
    {
      id: 'close_date',
      header: 'Expected Close',
      sortable: true,
      accessorKey: 'close_date',
      cell: (opp) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {opp.close_date
              ? new Date(opp.close_date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: (opp) =>
        opp.owner ? (
          <div className="flex items-center gap-1.5 text-slate-700 text-xs">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {opp.owner.first_name} {opp.owner.last_name}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      width: '80px',
      className: 'text-right',
      cell: (opp) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/opportunities/${opp.id}`}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>

          <PermissionGate action="opportunities.update">
            <button
              type="button"
              title="Edit Opportunity"
              onClick={() => setEditingOpportunity(opp)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#4361ee] transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>

          <PermissionGate action="opportunities.delete">
            <button
              type="button"
              title="Delete Opportunity"
              onClick={() => handleDeleteSingle(opp.id)}
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
      <PermissionGate action="opportunities.view" showAccessDenied>
        <div className="space-y-4">
          <div className="relative z-30 rounded-3xl border border-slate-100 bg-white shadow-2xs">
            <ListToolbar
              title="Opportunities"
              subtitle="Track sales pipeline stages, deal probabilities, and expected close revenue."
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
              onNewClick={() => setIsCreateModalOpen(true)}
              newButtonLabel="+ New Deal"
              canCreate={true}
            />
          </div>

          <BulkActionBar
            selectedCount={selectedIds.length}
            totalCount={totalCount}
            onSelectAll={() => handleSelectAll(true)}
            onClearSelection={() => setSelectedIds([])}
            onBulkDelete={handleBulkDelete}
            onExportSelected={handleExportSelected}
          />

          {viewMode === 'table' && (
            <>
              <DataGrid
                columns={columns}
                data={opportunities}
                keyExtractor={(o) => o.id}
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
                {opportunities.map((opp) => (
                  <article key={opp.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/opportunities/${opp.id}`}
                        className="text-base font-semibold text-slate-900 hover:text-[#4361ee] transition truncate"
                      >
                        {opp.name}
                      </Link>
                      <OpportunityStageBadge stage={opp.stage} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 truncate">
                      {opp.account ? opp.account.name : 'No account'}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="font-bold text-[#4361ee] text-sm">
                        ${Number(opp.amount || 0).toLocaleString()}
                      </span>
                      <span className="text-slate-500">{opp.probability || 0}% probability</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Close: {opp.close_date || '—'}
                    </div>
                    <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-3 text-sm">
                      <Link href={`/opportunities/${opp.id}`} className="text-[#4361ee] hover:text-[#4361ee] font-medium">
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditingOpportunity(opp)}
                        className="text-[#4361ee] hover:text-[#4361ee] font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!isLoading && opportunities.length === 0 && (
                <p className="rounded-xl bg-white p-8 text-center text-slate-500">No opportunities found.</p>
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

          {viewMode === 'split' && (
            <OpportunitySplitView
              opportunities={opportunities}
              isLoading={isLoading}
              onEditOpp={(opp) => setEditingOpportunity(opp)}
            />
          )}

          {viewMode === 'kanban' && (
            <OpportunityKanbanBoard opportunities={opportunities} isLoading={isLoading} />
          )}

          {viewMode === 'chart' && (
            <OpportunityChartView filters={filters} search={searchTerm} />
          )}
        </div>
      </PermissionGate>

      {/* Opportunity Filter Drawer */}
      <OpportunityFilterPanel
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

      {/* Create Opportunity Modal */}
      <OpportunityCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      {/* Edit Opportunity Modal */}
      {editingOpportunity && (
        <OpportunityEditModal
          isOpen={!!editingOpportunity}
          onClose={() => setEditingOpportunity(null)}
          opportunity={editingOpportunity}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: editingOpportunity.id, updates });
          }}
        />
      )}
    </PageContainer>
  );
}
