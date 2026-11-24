'use client';

import { useState, useTransition } from 'react';
import type { Role, Permission, RolePermission } from '@/lib/permissions/actions';
import {
  toggleRolePermission,
  createCustomRole,
  deleteCustomRole,
} from '@/lib/permissions/actions';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  Check,
  AlertCircle,
  Search,
  Filter,
} from 'lucide-react';

interface Props {
  initialRoles: Role[];
  initialPermissions: Permission[];
  initialRolePermissions: RolePermission[];
}

export function RoleMatrixClient({
  initialRoles,
  initialPermissions,
  initialRolePermissions,
}: Props) {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [permissions] = useState<Permission[]>(initialPermissions);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>(
    initialRolePermissions
  );
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    initialRoles[0]?.id || 'SUPER_ADMIN'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map((p) => p.module))).sort();

  const filteredPermissions = permissions.filter((p) => {
    const matchesSearch =
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = selectedModule === 'all' || p.module === selectedModule;
    return matchesSearch && matchesModule;
  });

  const isGranted = (roleId: string, permissionId: string) => {
    const match = rolePermissions.find(
      (rp) => rp.role_id === roleId && rp.permission_id === permissionId
    );
    return match ? match.is_granted : false;
  };

  const handleToggle = (permissionId: string) => {
    if (!selectedRole) return;
    
    const currentGranted = isGranted(selectedRole.id, permissionId);
    const newGranted = !currentGranted;

    // Optimistic UI update
    setRolePermissions((prev) => {
      const existingIndex = prev.findIndex(
        (rp) => rp.role_id === selectedRole.id && rp.permission_id === permissionId
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          is_granted: newGranted,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            role_id: selectedRole.id,
            permission_id: permissionId,
            is_granted: newGranted,
            created_at: new Date().toISOString(),
          },
        ];
      }
    });

    startTransition(async () => {
      const res = await toggleRolePermission(selectedRole.id, permissionId, newGranted);
      if (!res.success) {
        // Rollback
        setRolePermissions(initialRolePermissions);
        setStatusMessage({
          type: 'error',
          text: `Failed to update permission: ${res.error}`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Updated "${permissionId}" for ${selectedRole.name}.`,
        });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    });
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleId || !newRoleName) return;

    startTransition(async () => {
      const res = await createCustomRole({
        id: newRoleId,
        name: newRoleName,
        description: newRoleDesc,
      });

      if (!res.success) {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to create role.' });
      } else {
        setStatusMessage({ type: 'success', text: `Role ${newRoleName} created successfully.` });
        setIsModalOpen(false);
        setNewRoleId('');
        setNewRoleName('');
        setNewRoleDesc('');
        // Add locally
        const createdId = newRoleId.toUpperCase().replace(/\s+/g, '_');
        setRoles((prev) => [
          ...prev,
          {
            id: createdId,
            name: newRoleName,
            description: newRoleDesc,
            is_canonical: false,
            hierarchy_rank: 99,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        setSelectedRoleId(createdId);
      }
    });
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this custom role?')) return;

    startTransition(async () => {
      const res = await deleteCustomRole(roleId);
      if (!res.success) {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to delete role.' });
      } else {
        setStatusMessage({ type: 'success', text: 'Custom role deleted.' });
        setRoles((prev) => prev.filter((r) => r.id !== roleId));
        setSelectedRoleId('SUPER_ADMIN');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Dynamic Role & Permission Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage granular module permissions for canonical and custom roles. Single-company access governance.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs transition"
        >
          <Plus className="h-4 w-4" /> Add Custom Role
        </button>
      </div>

      {/* Notification banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Split Layout: Roles List on Left, Permission Matrix on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Roles List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Configured Roles ({roles.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {roles.map((r) => {
              const isSelected = r.id === selectedRoleId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`p-3.5 cursor-pointer transition flex items-center justify-between ${
                    isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{r.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.is_canonical ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Lock className="h-2.5 w-2.5" /> CANONICAL
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(r.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                        title="Delete custom role"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-3 space-y-6">
          {selectedRole && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{selectedRole.name}</h2>
                  {selectedRole.is_canonical ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Protected Canonical
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Custom Role
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedRole.description || 'No description provided.'}
                </p>
              </div>

              {selectedRole.id === 'BDO' && (
                <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <strong>Notice:</strong> Initial rule denies <code>leads.create</code> for BDO by default.
                </div>
              )}
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search action or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Modules ({modules.length})</option>
                {modules.map((m) => (
                  <option key={m} value={m}>
                    {m.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Permission ID</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status & Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermissions.map((perm) => {
                  const granted = selectedRole ? isGranted(selectedRole.id, perm.id) : false;

                  return (
                    <tr
                      key={perm.id}
                      className={`hover:bg-slate-50/80 transition ${
                        granted ? 'bg-white' : 'bg-slate-50/30 text-slate-400'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {perm.id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {perm.module}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{perm.description || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleToggle(perm.id)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                            granted ? 'bg-emerald-600' : 'bg-slate-300'
                          } ${isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              granted ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredPermissions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No matching permissions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for Creating Custom Role */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Custom Role</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a specialized business role for your company. Canonical roles remain preserved.
            </p>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Role Identifier (Code)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MARKETING_LEAD"
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value.toUpperCase())}
                  className="mt-1 w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marketing Lead"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Responsibilities and purpose..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
