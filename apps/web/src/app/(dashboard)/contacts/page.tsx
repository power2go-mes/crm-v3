'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ListToolbar } from '@/components/ui/data-grid/list-toolbar';
import { BulkActionBar } from '@/components/ui/data-grid/bulk-action-bar';
import { PaginationBar } from '@/components/ui/data-grid/pagination-bar';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { ContactCreateModal } from '@/components/contacts/contact-create-modal';
import { ContactEditModal } from '@/components/contacts/contact-edit-modal';
import { ContactFilterPanel } from '@/components/contacts/contact-filter-panel';
import { ContactKanbanBoard } from '@/components/contacts/contact-kanban-board';
import type { ViewMode } from '@/types/leads';
import {
  useContacts,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
} from '@/hooks/use-contacts';
import type { ContactWithRelations, ContactFilterState } from '@/types/contacts';
import Link from 'next/link';
import {
  Users,
  Building2,
  Mail,
  Phone,
  Eye,
  Edit2,
  Trash2,
  User,
  Star,
} from 'lucide-react';

const defaultFilters: ContactFilterState = {
  sources: [],
  isPrimary: null,
  ownerId: null,
  accountId: null,
  createdDateFrom: null,
  createdDateTo: null,
};

export default function ContactsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); // CRM v2 default for contacts is 20
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ContactFilterState>(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);

  // Queries & Mutations
  const { data, isLoading, refetch } = useContacts({
    page,
    pageSize,
    search: searchTerm,
    sortBy,
    sortOrder,
    filters,
    viewType,
  });

  const createMutation = useCreateContactMutation();
  const updateMutation = useUpdateContactMutation();
  const deleteMutation = useDeleteContactMutation();

  const contacts = data?.contacts || [];
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
    setSelectedIds(all ? contacts.map((c) => c.id) : []);
  };

  // Deletion
  const handleDeleteSingle = async (contactId: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      await deleteMutation.mutateAsync(contactId);
      setSelectedIds((prev) => prev.filter((i) => i !== contactId));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} contact(s)?`)) {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedContacts = contacts.filter((c) => selectedIds.includes(c.id));
    const headers = ['First Name', 'Last Name', 'Title', 'Account', 'Email', 'Phone', 'Created At'];
    const rows = selectedContacts.map((c) => [
      c.first_name || '',
      c.last_name || '',
      c.title || '',
      c.account?.name || '',
      c.email || '',
      c.contact_number || '',
      c.created_at || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeFilterCount =
    filters.sources.length +
    (filters.isPrimary !== null ? 1 : 0) +
    (filters.ownerId ? 1 : 0) +
    (filters.accountId ? 1 : 0) +
    (filters.createdDateFrom ? 1 : 0) +
    (filters.createdDateTo ? 1 : 0);

  const columns: ColumnDef<ContactWithRelations>[] = [
    {
      id: 'name',
      header: 'Contact Name',
      sortable: true,
      accessorKey: 'first_name',
      cell: (contact) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-600/10 text-emerald-600 rounded-lg">
            <Users className="h-4 w-4" />
          </div>
          <Link
            href={`/contacts/${contact.id}`}
            className="font-medium text-slate-900 hover:text-emerald-800 transition flex items-center gap-1.5"
          >
            <span>
              {contact.first_name} {contact.last_name}
            </span>
            {contact.is_primary && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded">
                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Primary
              </span>
            )}
          </Link>
        </div>
      ),
    },
    {
      id: 'title',
      header: 'Title',
      sortable: true,
      accessorKey: 'title',
      cell: (contact) => <span className="text-slate-700">{contact.title || '—'}</span>,
    },
    {
      id: 'account',
      header: 'Account',
      cell: (contact) =>
        contact.account ? (
          <div className="flex items-center gap-1.5 text-slate-700">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <Link
              href={`/accounts/${contact.account.id}`}
              className="hover:text-emerald-800 transition"
            >
              {contact.account.name}
            </Link>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      id: 'email',
      header: 'Email',
      sortable: true,
      accessorKey: 'email',
      cell: (contact) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
          {contact.email ? (
            <>
              <Mail className="h-3 w-3 text-slate-400" />
              <a
                href={`mailto:${contact.email}`}
                className="hover:text-emerald-800 truncate max-w-[180px]"
              >
                {contact.email}
              </a>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'contact_number',
      header: 'Phone',
      accessorKey: 'contact_number',
      cell: (contact) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
          {contact.contact_number ? (
            <>
              <Phone className="h-3 w-3 text-slate-400" />
              <span>{contact.contact_number}</span>
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
      cell: (contact) =>
        contact.contact_owner ? (
          <div className="flex items-center gap-1.5 text-slate-700 text-xs">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {contact.contact_owner.first_name} {contact.contact_owner.last_name}
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
      cell: (contact) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/contacts/${contact.id}`}
            title="View Details"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>

          <PermissionGate action="contacts.update">
            <button
              type="button"
              title="Edit Contact"
              onClick={() => setEditingContact(contact)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-emerald-800 transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>

          <PermissionGate action="contacts.delete">
            <button
              type="button"
              title="Delete Contact"
              onClick={() => handleDeleteSingle(contact.id)}
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
      <PermissionGate action="contacts.view" showAccessDenied>
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white shadow-2xs overflow-hidden">
            <ListToolbar
            title="Contacts"
            subtitle="Manage people, decision-makers, and key stakeholder relationships."
            viewType={viewType}
            onViewTypeChange={(type) => {
              setViewType(type);
              setSelectedIds([]);
              setPage(1);
            }}
            viewMode={viewMode}
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
            newButtonLabel="New Contact"
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

          {viewMode === 'kanban' ? (
            <ContactKanbanBoard
              contacts={contacts}
              isLoading={isLoading}
              onContactClick={(c) => setEditingContact(c)}
            />
          ) : (
            <>
              <DataGrid
                columns={columns}
                data={contacts}
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
        </div>
      </PermissionGate>

      {/* Contact Filter Drawer */}
      <ContactFilterPanel
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

      {/* Create Contact Modal */}
      <ContactCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      {/* Edit Contact Modal */}
      {editingContact && (
        <ContactEditModal
          isOpen={!!editingContact}
          onClose={() => setEditingContact(null)}
          contact={editingContact}
          onSubmit={async (payload) => {
            await updateMutation.mutateAsync(payload);
          }}
        />
      )}
    </PageContainer>
  );
}
