'use client';

import { useState } from 'react';
import { useUpdateUser, type UserProfileDetail } from '@/hooks/use-users';

interface UserEditModalProps {
  user: UserProfileDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserEditModal({ user, isOpen, onClose }: UserEditModalProps) {
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [designation, setDesignation] = useState(user?.designation || '');
  const [error, setError] = useState<string | null>(null);

  const updateUserMutation = useUpdateUser();

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateUserMutation.mutateAsync({
        userId: user.id,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        department: department || null,
        designation: designation || null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update employee details.');
    }
  };

  const isPending = updateUserMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Edit Employee Profile
            </h2>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Assigned Role
            </label>
            <input
              type="text"
              disabled
              value={user.roleName}
              className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Sales, Commercial, Operations"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Designation / Title
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Senior Account Executive"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !firstName || !lastName}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
