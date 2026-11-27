'use client';

import { INDUSTRY_CHOICES, LEAD_SOURCES } from '@/types/leads';

import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { leadDeleteError, leadQueryKey } from '@/lib/leads/query-contract';
import { leadDuplicateDraft } from '@/lib/leads/duplicate';
import { LeadRecovery } from '@/components/leads/lead-recovery';
import { useAuth } from '@/components/providers/auth-provider';
import { useLeadPreferences, usePinLeadView } from '@/hooks/use-lead-preferences';
import { LeadExportModal } from '@/components/leads/lead-export-modal';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { LeadKanbanBoard } from '@/components/leads/lead-kanban-board';
import { leadDetailHref, storeLeadNavigation } from '@/hooks/use-lead-navigation';
import { LeadSplitView } from '@/components/leads/lead-split-view';
import { LeadChartView, type LeadChartSelection } from '@/components/leads/lead-chart-view';
import { LeadFilterPanel } from '@/components/leads/lead-filter-panel';
import { LeadCreateModal } from '@/components/leads/lead-create-modal';
import { LeadEditModal } from '@/components/leads/lead-edit-modal';
import { LeadConvertModal } from '@/components/leads/lead-convert-modal';
import { WebToLeadModal } from '@/components/leads/web-to-lead-modal';
import {
  useLeads,
  useSaveLeadForm,
  useDeleteLeadMutation,
  useBulkDeleteLeadsMutation,
  useBulkUpdateLeadsMutation,
  useLeadStatuses,
  useConvertLeadMutation,
} from '@/hooks/use-leads';
import type { LeadWithRelations, ViewMode, LeadFilterState } from '@/types/leads';
import Link from 'next/link';
import {
  Eye,
  Edit2,
  Copy,
  Shuffle,
  Trash2,
  Building2,
  Mail,
  UserCheck,
  Globe,
  Filter,
} from 'lucide-react';

const defaultFilters: LeadFilterState = {
  search: '',
  status: [],
  source: [],
  industry: [],
  ownerId: null,
  subOwnerId: null,
  dateFrom: null,
  dateTo: null,
  minRevenue: null,
  maxRevenue: null,
};

export default function LeadsPage() {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const preferences = useLeadPreferences();
  const pin = usePinLeadView();
  const [exportOpen, setExportOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  // State for layout & search & filter
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [chartSelection, setChartSelection] = useState<LeadChartSelection>({group:'status',value:'count',kind:'column'});
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<LeadFilterState>(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [duplicateDraft, setDuplicateDraft] = useState<Record<string, string>>();
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [isWebToLeadOpen, setIsWebToLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithRelations | null>(null);
  const [convertingLead, setConvertingLead] = useState<LeadWithRelations | null>(null);

  const pinnedView = preferences.data?.preferences.find(p => p.context === '' && p.url_name === 'leads_list')?.state.pinnedView;
  const [pinRestored, setPinRestored] = useState(false);
  useEffect(() => {
    if (pinRestored || !preferences.data) return;
    if (pinnedView && ['all', 'recently_viewed', 'recently_created', 'recently_modified', 'oldest_first', 'converted'].includes(pinnedView)) {
      setViewType(pinnedView);
      if (pinnedView === 'converted') setViewMode('table');
    }
    setPinRestored(true);
  }, [pinnedView, preferences.data, pinRestored]);

  // Queries
  const {
    data: leadsData,
    isLoading: isLeadsLoading,
    error: listError,
    refetch,
  } = useLeads(
    {
      page,
      pageSize,
      sortBy,
      sortOrder,
    },
    {
      ...filters,
      search: searchTerm,
    },
    viewType
  );

  // Mutations
  const saveForm = useSaveLeadForm();
  const deleteMutation = useDeleteLeadMutation();
  const bulkUpdate = useBulkUpdateLeadsMutation();
  const stages = useLeadStatuses();
  const [bulkField, setBulkField] = useState('status');
  const [bulkValue, setBulkValue] = useState('');
  const bulkFields = [
    ['status', 'Stage'], ['lead_source', 'Source'], ['industry', 'Industry'],
    ['annual_revenue', 'Annual revenue'], ['no_of_employees', 'Number of employees'],
  ] as const;
  const bulkOptions = bulkField === 'status'
    ? (stages.data ?? []).filter(stage => !stage.is_final).map(stage => ({ value: stage.id, label: stage.name }))
    : bulkField === 'lead_source' ? LEAD_SOURCES : bulkField === 'industry' ? INDUSTRY_CHOICES : null;
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const bulkDeleteMutation = useBulkDeleteLeadsMutation();
  const convertMutation = useConvertLeadMutation();

  const leads = leadsData?.leads || [];
  const totalCount = leadsData?.totalCount || 0;

  function rememberLead(leadId: string) {
    storeLeadNavigation(user?.id, leadId, {
      pagination: { page, pageSize, sortBy, sortOrder },
      filters: { ...filters, search: searchTerm },
      viewType,
    });
  }

  async function openDuplicate(lead: LeadWithRelations) {
    if (!hasPermission('leads.create') || duplicatePending) return;
    setActionError('');
    setDuplicatePending(true);
    try {
      setDuplicateDraft(await leadDuplicateDraft(lead));
      setIsCreateModalOpen(true);
    } catch {
      setActionError('The Lead could not be copied into a new form.');
    } finally {
      setDuplicatePending(false);
    }
  }

  // Sorting handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Selection handlers
  const handleSelectRow = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(leads.map((l) => l.id));
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} lead(s)?`)) {
      setActionError('');
      try {
        await bulkDeleteMutation.mutateAsync(selectedIds);
        setSelectedIds([]);
      } catch (error) {
        setActionError(leadDeleteError(error));
      }
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf', columns: string[]) => {
    const response = await fetch('/api/leads/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'leads', ids: selectedIds, columns, format,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    if (!response.ok) throw new Error('Export unavailable');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = 'leads-export.' + format;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Single delete
  const handleDeleteSingle = async (leadId: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      setActionError('');
      try {
        await deleteMutation.mutateAsync(leadId);
        setSelectedIds((prev) => prev.filter((i) => i !== leadId));
      } catch (error) {
        setActionError(leadDeleteError(error));
      }
    }
  };

  // Columns for DataGrid
  const columns: ColumnDef<LeadWithRelations>[] = [
    { id: 'title', header: 'Title', accessorKey: 'title', sortable: true,
      cell: lead => <Link href={leadDetailHref(lead.id)} onClick={() => rememberLead(lead.id)} className="font-medium text-slate-900 hover:text-emerald-800">{lead.title || 'â€”'}</Link> },
    { id: 'first_name', header: 'First Name', accessorKey: 'first_name', sortable: true },
    { id: 'last_name', header: 'Last Name', accessorKey: 'last_name', sortable: true },
    { id: 'email', header: 'Email', accessorKey: 'email', sortable: true },
    { id: 'status', header: 'Lead Status', accessorKey: 'status', sortable: true,
      cell: lead => <LeadStatusBadge status={lead.status} /> },
    { id: 'lead_source', header: 'Lead Source', accessorKey: 'lead_source', sortable: true },
    { id: 'industry', header: 'Industry', accessorKey: 'industry', sortable: true },
    { id: 'annual_revenue', header: 'Annual Revenue', accessorKey: 'annual_revenue', sortable: true,
      cell: lead => lead.annual_revenue == null ? 'â€”' : Number(lead.annual_revenue).toLocaleString() },
    {
      id: 'actions',
      header: '',
      width: '60px',
      className: 'text-right',
      cell: (lead) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={leadDetailHref(lead.id)} onClick={() => rememberLead(lead.id)}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>

          <PermissionGate action="leads.update">
            <button
              type="button"
              title="Edit Lead"
              onClick={() => setEditingLead(lead)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-600 transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>

          <PermissionGate action="leads.create">
            <button type="button" title="Duplicate" aria-label="Duplicate" disabled={duplicatePending}
              onClick={() => void openDuplicate(lead)} className="rounded p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-800">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>

          {!lead.is_convert && (
            <PermissionGate action="leads.update">
              <button
                type="button"
                title="Convert Lead"
                onClick={() => setConvertingLead(lead)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>
            </PermissionGate>
          )}

          <PermissionGate action="leads.delete">
            <button
              type="button"
              title="Delete Lead"
              onClick={() => handleDeleteSingle(lead.id)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const activeFilterCount =
    filters.status.length +
    filters.source.length +
    filters.industry.length +
    (filters.ownerId ? 1 : 0) +
    (filters.subOwnerId ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.minRevenue != null ? 1 : 0) +
    (filters.maxRevenue != null ? 1 : 0);

  return (
    <PageContainer maxWidth="full">
      <PermissionGate action="leads.view" showAccessDenied>
        <div className="space-y-4">
          {(listError || actionError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 shadow-2xs">
            {actionError || 'The lead list could not be loaded. Retry or check your access.'}
          </p>}

          {/* Main Toolbar with integrated rounded styling */}
          <div className="rounded-3xl border border-slate-100 bg-white shadow-2xs overflow-hidden">
            <ListToolbar
              title="Leads"
              subtitle={viewMode === 'chart' ? undefined : 'Manage acquisition opportunities, qualification status, and rep assignments.'}
              viewType={viewType}
              onViewTypeChange={(type) => {
                setViewType(type);
                setSelectedIds([]);
                if (type === 'converted') setViewMode('table');
                setPage(1);
              }}
              viewMode={viewMode}
              showLeadViews
              onViewModeChange={setViewMode}
              searchValue={searchTerm}
              onSearchChange={(val) => {
                setSearchTerm(val);
                setPage(1);
              }}
              onReload={() => viewMode === 'chart'
                ? queryClient.invalidateQueries({queryKey: leadQueryKey(user?.id, 'chart')})
                : refetch()}
              onFilterToggle={() => setIsFilterPanelOpen((prev) => !prev)}
              isFilterOpen={isFilterPanelOpen}
              activeFilterCount={activeFilterCount}
              onPinClick={() => { void pin.mutateAsync(pinnedView === viewType ? null : viewType).catch(error => setActionError(error.message)); }}
              pinned={pinnedView === viewType}
              pinPending={pin.isPending}
              onNewClick={() => setIsCreateModalOpen(true)}
              newButtonLabel="+ New Lead"
              canCreate={hasPermission('leads.create') && viewType !== 'converted'}
            />

            {/* Sub-bar for Web-to-Lead, Quick Filters, and Recycle Bin */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 bg-slate-50/60 border-t border-slate-100 text-xs rounded-b-2xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWebToLeadOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition shadow-2xs hover:border-slate-300"
                >
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Web-to-Lead Forms</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition font-semibold shadow-2xs ${
                    isFilterPanelOpen || activeFilterCount > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
                </button>
              </div>

              {hasPermission('recycle_bin.view') && (
                <button
                  type="button"
                  aria-expanded={recoveryOpen}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition font-medium shadow-2xs ${
                    recoveryOpen
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                  onClick={() => setRecoveryOpen((open) => !open)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>Deleted Leads</span>
                </button>
              )}
            </div>
          </div>

          {recoveryOpen && hasPermission('recycle_bin.view') && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <LeadRecovery onClose={() => setRecoveryOpen(false)} />
            </div>
          )}

          {/* Bulk Selection Bar */}
          {viewMode !== 'chart' && <BulkActionBar
            selectedCount={selectedIds.length}
            totalCount={totalCount}
            onSelectAll={handleSelectAll}
            onClearSelection={() => setSelectedIds([])}
            onBulkDelete={handleBulkDelete}
            onExportSelected={hasPermission('leads.export') ? () => setExportOpen(true) : undefined}
            canDelete={hasPermission('leads.delete')}
          />}

          {viewMode === 'table' && viewType !== 'converted' && selectedIds.length > 0 && hasPermission('leads.update') && (
            <form className="flex flex-wrap items-end gap-3 rounded border bg-white p-3" onSubmit={async event => {
              event.preventDefault();
              const label = bulkFields.find(([key]) => key === bulkField)?.[1];
              if (!label || !bulkValue || bulkUpdate.isPending || !window.confirm('Change ' + label + ' for ' + selectedIds.length + ' selected Leads?')) return;
              setActionError('');
              try {
                await bulkUpdate.mutateAsync({ ids: selectedIds, field: bulkField, value: bulkValue });
                setSelectedIds([]);
                setBulkValue('');
              } catch { setActionError('Could not update every selected Lead. No changes were saved.'); }
            }}>
              <label className="grid gap-1 text-sm">Bulk update field
                <select className="rounded border px-3 py-2" value={bulkField} onChange={event => { setBulkField(event.target.value); setBulkValue(''); }}>
                  {bulkFields.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">New value
                {bulkOptions ? <select className="rounded border px-3 py-2" value={bulkValue} onChange={event => setBulkValue(event.target.value)} required>
                  <option value="">Choose a value</option>
                  {bulkOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select> : <input className="rounded border px-3 py-2" type="number" min="0"
                  step={bulkField === 'annual_revenue' ? '0.01' : '1'} value={bulkValue} onChange={event => setBulkValue(event.target.value)} required />}
              </label>
              <button type="submit" className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
                disabled={!bulkValue || bulkUpdate.isPending}>Apply to selected</button>
            </form>
          )}

          {/* Views */}
          {viewMode === 'table' && (
            <>
              <DataGrid
                columns={viewType === 'converted' ? columns.filter(column => column.id !== 'actions') : columns}
                data={leads}
                keyExtractor={(l) => l.id}
                selectedIds={selectedIds}
                onSelectRow={handleSelectRow}
                onSelectAll={(all) => (all ? handleSelectAll() : setSelectedIds([]))}
                sortField={sortBy}
                sortDirection={sortOrder}
                onSort={handleSort}
                isLoading={isLeadsLoading}
              />
              <PaginationBar
                currentPage={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(newLimit) => {
                  setPageSize(newLimit);
                  setPage(1);
                }}
              />
            </>
          )}

          {viewMode === 'kanban' && (
            <LeadKanbanBoard
              leads={leads}
              isLoading={isLeadsLoading}
            />
          )}

          {viewMode === 'card' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {leads.map(lead => <article key={lead.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <Link href={leadDetailHref(lead.id)} onClick={() => rememberLead(lead.id)} className="text-base font-semibold text-slate-900 hover:text-emerald-800">{lead.title || `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Untitled Lead'}</Link>
                  <div className="mt-3 flex items-center justify-between"><LeadStatusBadge status={lead.status}/><span className="text-xs text-slate-500">{lead.lead_source || 'No source'}</span></div>
                  <p className="mt-3 text-sm text-slate-600">{lead.company_name || 'No company'}</p>
                  <p className="mt-1 text-sm text-slate-600">{lead.email || 'No email'}</p>
                  <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-3 text-sm">
                    <Link href={leadDetailHref(lead.id)} onClick={() => rememberLead(lead.id)} className="text-emerald-800">View</Link>
                    {hasPermission('leads.update') && <button onClick={() => setEditingLead(lead)} className="text-emerald-800">Edit</button>}
                  </div>
                </article>)}
              </div>
              {!isLeadsLoading && leads.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-slate-500">No leads found.</p>}
              <PaginationBar currentPage={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={newLimit => { setPageSize(newLimit); setPage(1); }}/>
            </>
          )}

          {viewMode === 'chart' && <LeadChartView filters={filters} search={searchTerm} viewType={viewType} selection={chartSelection} onSelectionChange={setChartSelection} />}

          {viewMode === 'split' && (
            <LeadSplitView
              leads={leads}
              isLoading={isLeadsLoading}
              detailHref={leadDetailHref}
              onOpenDetail={rememberLead}
              onEditLead={(lead) => setEditingLead(lead)}
              onConvertLead={(lead) => setConvertingLead(lead)}
            />
          )}
        </div>
      </PermissionGate>

      {exportOpen && <LeadExportModal onClose={() => setExportOpen(false)} onExport={handleExport} />}

      {/* Filter Slide-over Drawer */}
      <LeadFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
        onResetFilters={() => {
          setFilters(defaultFilters);
          setPage(1);
        }}
      />

      {/* 4-Step Create Lead Modal */}
      {isCreateModalOpen && <LeadCreateModal
        isOpen={isCreateModalOpen}
        duplicateDraft={duplicateDraft}
        onClose={() => { setIsCreateModalOpen(false); setDuplicateDraft(undefined); }}
        onSubmit={async (payload, saveAndNew, custom) => {
          await saveForm.mutateAsync({ standard: payload, custom: custom ?? {} });
          if (!saveAndNew) {
            setIsCreateModalOpen(false);
            setDuplicateDraft(undefined);
          }
        }}
      />}

      {/* Edit Lead Modal */}
      {editingLead && (
        <LeadEditModal
          isOpen={!!editingLead}
          onClose={() => setEditingLead(null)}
          lead={editingLead}
          onSubmit={async (updates, custom) => {
            await saveForm.mutateAsync({ id: editingLead.id, standard: updates, custom: custom ?? {} });
            setEditingLead(null);
          }}
        />
      )}

      {/* Convert Lead Modal */}
      {convertingLead && (
        <LeadConvertModal
          isOpen={!!convertingLead}
          onClose={() => setConvertingLead(null)}
          lead={convertingLead}
          onConvert={async (payload) => {
            return await convertMutation.mutateAsync(payload);
          }}
        />
      )}

      {/* Web-to-Lead Forms Modal */}
      <WebToLeadModal
        isOpen={isWebToLeadOpen}
        onClose={() => setIsWebToLeadOpen(false)}
      />
    </PageContainer>
  );
}
