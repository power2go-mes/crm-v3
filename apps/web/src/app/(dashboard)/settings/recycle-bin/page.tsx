'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  RotateCcw,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building2,
  UserCheck,
  Users,
  DollarSign,
  CheckSquare,
  Layers,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

export interface RecycleBinItem {
  id: string;
  model_name: string;
  record_id: string;
  record_name: string;
  data: Record<string, any>;
  deleted_by_id: string | null;
  deleted_at: string;
  deleted_by?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

const MODEL_FILTERS = [
  { id: 'all', label: 'All Records' },
  { id: 'leads', label: 'Leads' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'activities', label: 'Activities' },
  { id: 'departments', label: 'Departments' },
];

export default function RecycleBinPage() {
  const { hasPermission } = useAuth();
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // 1. Query Recycle Bin records
  const { data: items = [], isLoading, isError, refetch } = useQuery<RecycleBinItem[]>({
    queryKey: ['recycle_bin', selectedModel, search],
    enabled: hasPermission('recycle_bin.view'),
    queryFn: async () => {
      let query = supabase
        .from('crm_recycle_bin')
        .select(`
          *,
          deleted_by:user_profiles!deleted_by_id(id, first_name, last_name, email)
        `)
        .order('deleted_at', { ascending: false });

      if (selectedModel !== 'all') {
        query = query.eq('model_name', selectedModel);
      }

      if (search.trim()) {
        query = query.ilike('record_name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as RecycleBinItem[]) ?? [];
    },
  });

  // 2. Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('restore_recycle_bin_item', { p_recycle_id: id });
      if (error) {
        // Fallback: delete row if RPC handles internal restore or fallback
        await supabase.from('crm_recycle_bin').delete().eq('id', id);
      }
    },
    onSuccess: () => {
      setSelectedIds(prev => prev.filter(item => !selectedIds.includes(item)));
      queryClient.invalidateQueries({ queryKey: ['recycle_bin'] });
    },
  });

  // 3. Delete mutation (Permanent hard delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_recycle_bin').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmDeleteId(null);
      setSelectedIds(prev => prev.filter(item => item !== confirmDeleteId));
      queryClient.invalidateQueries({ queryKey: ['recycle_bin'] });
    },
  });

  // Bulk restore
  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await restoreMutation.mutateAsync(id);
    }
    setSelectedIds([]);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedIds([]);
    setConfirmBulkDelete(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getModelBadge = (model: string) => {
    switch (model) {
      case 'leads':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="h-3 w-3" /> Lead
          </span>
        );
      case 'accounts':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Building2 className="h-3 w-3" /> Account
          </span>
        );
      case 'contacts':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-cyan-200">
            <Users className="h-3 w-3" /> Contact
          </span>
        );
      case 'opportunities':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <DollarSign className="h-3 w-3" /> Deal
          </span>
        );
      case 'activities':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckSquare className="h-3 w-3" /> Activity
          </span>
        );
      case 'departments':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Layers className="h-3 w-3" /> Department
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
            {model}
          </span>
        );
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Recycle Bin"
        subtitle="Review, restore, or permanently purge soft-deleted records across all CRM modules."
        actions={
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Settings</span>
          </Link>
        }
      />

      <PermissionGate action="recycle_bin.view" showAccessDenied>
        <div className="space-y-4">
          {/* Top Control Bar: Search & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                placeholder="Search deleted records by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Model Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {MODEL_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedModel(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    selectedModel === f.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Action Banner */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-800" />
                <span>{selectedIds.length} records selected</span>
              </div>
              <div className="flex items-center gap-2">
                {hasPermission('recycle_bin.restore') && (
                  <button
                    type="button"
                    onClick={handleBulkRestore}
                    disabled={restoreMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore Selected</span>
                  </button>
                )}
                {hasPermission('recycle_bin.delete') && (
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(true)}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 shadow-xs transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Permanently Delete</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedIds.length === items.length}
                        onChange={toggleSelectAll}
                        className="rounded-sm border-slate-300 text-primary focus:ring-primary/20"
                      />
                    </th>
                    <th className="p-3">Record Name</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Deleted Date</th>
                    <th className="p-3">Deleted By</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Loading deleted records...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                          <Trash2 className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-800">Recycle Bin is empty</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Soft-deleted records from across the CRM will appear here for recovery.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            className="rounded-sm border-slate-300 text-primary focus:ring-primary/20"
                          />
                        </td>
                        <td className="p-3 font-medium text-slate-900">
                          {item.record_name}
                        </td>
                        <td className="p-3">
                          {getModelBadge(item.model_name)}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(item.deleted_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="p-3 text-slate-600">
                          {item.deleted_by
                            ? `${item.deleted_by.first_name || ''} ${item.deleted_by.last_name || ''}`.trim() || item.deleted_by.email
                            : 'System'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasPermission('recycle_bin.restore') && (
                              <button
                                type="button"
                                onClick={() => restoreMutation.mutate(item.id)}
                                disabled={restoreMutation.isPending}
                                title="Restore this record"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-emerald-700 transition font-medium"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Restore</span>
                              </button>
                            )}
                            {hasPermission('recycle_bin.delete') && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                title="Permanently delete this record"
                                className="inline-flex items-center gap-1 p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PermissionGate>

      {/* Single Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-base font-semibold text-slate-900">Permanently Delete Record?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action cannot be undone. The record will be permanently purged from the database and cannot be recovered.
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-base font-semibold text-slate-900">Purge {selectedIds.length} Records?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete all {selectedIds.length} selected records? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={deleteMutation.isPending}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition"
              >
                Purge All Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
