'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { AccountCreateModal } from '@/components/accounts/account-create-modal';
import { AccountEditModal } from '@/components/accounts/account-edit-modal';
import { AccountFilterPanel } from '@/components/accounts/account-filter-panel';
import {
  useAccounts,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
} from '@/hooks/use-accounts';
import type { AccountWithRelations, AccountFilterState } from '@/types/accounts';
import Link from 'next/link';
import {
  Building2,
  Eye,
  Edit2,
  Trash2,
  User,
  Globe,
  DollarSign,
  Phone,
} from 'lucide-react';

const defaultFilters: AccountFilterState = {
  accountTypes: [],
  industries: [],
  accountSources: [],
  ownership: [],
  ownerId: null,
  minRevenue: null,
  maxRevenue: null,
  createdDateFrom: null,
  createdDateTo: null,
};

export default function AccountsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<AccountFilterState>(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithRelations | null>(null);

  // Queries & Mutations
  const { data, isLoading, refetch } = useAccounts({
    page,
    pageSize,
    search: searchTerm,
    sortBy,
    sortOrder,
    filters,
    viewType,
  });

  const createMutation = useCreateAccountMutation();
  const updateMutation = useUpdateAccountMutation();
  const deleteMutation = useDeleteAccountMutation();

  const accounts = data?.accounts || [];
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
    setSelectedIds(all ? accounts.map((a) => a.id) : []);
  };

  // Deletion
  const handleDeleteSingle = async (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      await deleteMutation.mutateAsync(accountId);
      setSelectedIds((prev) => prev.filter((i) => i !== accountId));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} account(s)?`)) {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedAccounts = accounts.filter((a) => selectedIds.includes(a.id));
    const headers = ['Account Name', 'Industry', 'Source', 'Revenue', 'Phone', 'Website', 'Created At'];
    const rows = selectedAccounts.map((a) => [
      a.name || '',
      a.industry || '',
      a.account_source || '',
      a.annual_revenue || '',
      a.contact_number || '',
      a.website || '',
      a.created_at || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `accounts_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeFilterCount =
    filters.accountTypes.length +
    filters.industries.length +
    filters.accountSources.length +
    filters.ownership.length +
    (filters.ownerId ? 1 : 0) +
    (filters.minRevenue != null ? 1 : 0) +
    (filters.maxRevenue != null ? 1 : 0) +
    (filters.createdDateFrom ? 1 : 0) +
    (filters.createdDateTo ? 1 : 0);

  const columns: ColumnDef<AccountWithRelations>[] = [
    {
      id: 'name',
      header: 'Account Name',
      sortable: true,
      accessorKey: 'name',
      cell: (acc) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
            <Building2 className="h-4 w-4" />
          </div>
          <Link
            href={`/accounts/${acc.id}`}
            className="font-medium text-slate-900 hover:text-blue-600 transition"
          >
            {acc.name}
          </Link>
        </div>
      ),
    },
    {
      id: 'industry',
      header: 'Industry',
      sortable: true,
      accessorKey: 'industry',
      cell: (acc) => (
        <span className="capitalize text-slate-700">{acc.industry || '—'}</span>
      ),
    },
    {
      id: 'account_type',
      header: 'Type',
      sortable: true,
      accessorKey: 'account_type',
      cell: (acc) => (
        <span className="capitalize text-slate-700">
          {acc.account_type?.replace(/_/g, ' ') || '—'}
        </span>
      ),
    },
    {
      id: 'annual_revenue',
      header: 'Annual Revenue',
      sortable: true,
      accessorKey: 'annual_revenue',
      cell: (acc) => (
        <div className="font-semibold text-slate-800">
          {acc.annual_revenue != null ? (
            `$${Number(acc.annual_revenue).toLocaleString()}`
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'contact_number',
      header: 'Phone',
      accessorKey: 'contact_number',
      cell: (acc) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
          {acc.contact_number ? (
            <>
              <Phone className="h-3 w-3 text-slate-400" />
              <span>{acc.contact_number}</span>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'website',
      header: 'Website',
      accessorKey: 'website',
      cell: (acc) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
          {acc.website ? (
            <>
              <Globe className="h-3 w-3 text-slate-400" />
              <a
                href={acc.website.startsWith('http') ? acc.website : `https://${acc.website}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-600 truncate max-w-[150px]"
              >
                {acc.website.replace(/^https?:\/\//, '')}
              </a>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: (acc) =>
        acc.account_owner ? (
          <div className="flex items-center gap-1.5 text-slate-700 text-xs">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {acc.account_owner.first_name} {acc.account_owner.last_name}
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
      cell: (acc) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/accounts/${acc.id}`}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>

          <PermissionGate action="accounts.update">
            <button
              type="button"
              title="Edit Account"
              onClick={() => setEditingAccount(acc)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>

          <PermissionGate action="accounts.delete">
            <button
              type="button"
              title="Delete Account"
              onClick={() => handleDeleteSingle(acc.id)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PermissionGate action="accounts.view" showAccessDenied>
        <div className="space-y-4">
          <ListToolbar
            title="Accounts"
            subtitle="Manage organizations, client companies, and institutional customer profiles."
            viewType={viewType}
            onViewTypeChange={(type) => {
              setViewType(type);
              setSelectedIds([]);
              setPage(1);
            }}
            viewMode="table"
            onViewModeChange={() => {}}
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
            newButtonLabel="New Account"
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
            data={accounts}
            keyExtractor={(a) => a.id}
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
        </div>
      </PermissionGate>

      {/* Account Filter Drawer */}
      <AccountFilterPanel
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

      {/* Create Account Modal */}
      <AccountCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      {/* Edit Account Modal */}
      {editingAccount && (
        <AccountEditModal
          isOpen={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          account={editingAccount}
          onSubmit={async (updates) => {
            await updateMutation.mutateAsync({ id: editingAccount.id, updates });
          }}
        />
      )}
    </PageContainer>
  );
}
