'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useAuth } from '@/components/providers/auth-provider';
import { useUsersList, useToggleUserActive, type UserProfileDetail } from '@/hooks/use-users';
import { DataGrid } from '@/components/ui/data-grid/data-grid';
import { UserEditModal } from '@/components/users/user-edit-modal';

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState<string>('');
  const [editingUser, setEditingUser] = useState<UserProfileDetail | null>(null);

  const { data: users = [], isLoading, isError, refetch } = useUsersList();
  const toggleActiveMutation = useToggleUserActive();

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  const filteredUsers = users.filter((u) => {
    if (selectedRole !== 'all' && u.roleId !== selectedRole) return false;
    if (selectedStatus === 'active' && !u.is_active) return false;
    if (selectedStatus === 'inactive' && u.is_active) return false;

    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        u.first_name.toLowerCase().includes(term) ||
        u.last_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.designation && u.designation.toLowerCase().includes(term)) ||
        (u.department && u.department.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const getRoleBadgeColor = (roleId: string) => {
    switch (roleId) {
      case 'SUPER_ADMIN':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'HEAD_OF_SALES':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'RSM':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'SSM':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-[#4361ee]/30 dark:text-[#4361ee]';
      case 'ASM':
        return 'bg-[#eef2ff] text-[#4361ee] dark:bg-indigo-900/30 dark:text-indigo-200';
      case 'BDO':
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    }
  };

  const handleToggleStatus = async (user: UserProfileDetail) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${user.first_name} ${user.last_name}?`)) {
      return;
    }

    try {
      await toggleActiveMutation.mutateAsync({
        userId: user.id,
        isActive: !user.is_active,
      });
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Employee Directory"
        subtitle="Manage employee accounts, reporting hierarchy assignments, and active system access."
      />

      <PermissionGate action="users.view" showAccessDenied>
        {/* Top Summary Metrics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Total Personnel</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">{users.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Active Employees</span>
            <p className="mt-1 text-2xl font-bold text-[#4361ee] dark:text-[#4361ee]">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Deactivated / Suspended</span>
            <p className="mt-1 text-2xl font-bold text-slate-400">{inactiveCount}</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">All Roles</option>
              <option value="SUPER_ADMIN">Super Administrator</option>
              <option value="HEAD_OF_SALES">Head of Sales</option>
              <option value="RSM">Regional Sales Manager (RSM)</option>
              <option value="SSM">Senior Sales Manager (SSM)</option>
              <option value="ASM">Assistant Sales Manager (ASM)</option>
              <option value="BDO">Business Development Officer (BDO)</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <input
              type="text"
              placeholder="Search by name, email, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-indigo-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800 sm:w-64"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Directory DataGrid */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Personnel Records ({filteredUsers.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-transparent" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-sm text-red-600">
              Could not load employee directory.
            </div>
          ) : (
            <DataGrid<UserProfileDetail>
              data={filteredUsers}
              keyExtractor={(u) => u.id}
              columns={[
                {
                  id: 'name',
                  header: 'Employee',
                  cell: (u) => (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                        {(u.last_name?.[0] || '').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="text-xs text-slate-400">{u.designation || 'No Title'}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'email',
                  header: 'Email / Phone',
                  cell: (u) => (
                    <div>
                      <p className="text-xs text-slate-900">{u.email}</p>
                      {u.phone && <p className="text-xs text-slate-400">{u.phone}</p>}
                    </div>
                  ),
                },
                {
                  id: 'role',
                  header: 'Role',
                  cell: (u) => (
                    <span
                      className={`rounded px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeColor(
                        u.roleId
                      )}`}
                    >
                      {u.roleName}
                    </span>
                  ),
                },
                {
                  id: 'department',
                  header: 'Department',
                  cell: (u) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {u.department || '—'}
                    </span>
                  ),
                },
                {
                  id: 'manager',
                  header: 'Reports To',
                  cell: (u) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {u.managerName || '—'}
                    </span>
                  ),
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (u) => (
                    <button
                      type="button"
                      disabled={!hasPermission('users.update') && !hasPermission('users.deactivate')}
                      onClick={() => handleToggleStatus(u)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                        u.is_active
                          ? 'bg-[#eef2ff] text-[#4361ee] hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200'
                          : 'bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  ),
                },
                {
                  id: 'actions',
                  header: '',
                  cell: (u) =>
                    hasPermission('users.update') ? (
                      <button
                        onClick={() => setEditingUser(u)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                    ) : null,
                },
              ]}
            />
          )}
        </div>

        {/* Edit Modal */}
        {editingUser && (
          <UserEditModal
            user={editingUser}
            isOpen={!!editingUser}
            onClose={() => setEditingUser(null)}
          />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
