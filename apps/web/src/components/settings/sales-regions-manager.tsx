'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { MapPin, Plus, CheckCircle2, XCircle, Users } from 'lucide-react';
import { loadSalesRegions, setSalesRegionActive } from '@/lib/settings/sales-regions';

interface SalesRegion {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export function SalesRegionsManager() {
  const { user, profile, permissions, isLoading: authLoading, hasPermission } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const cacheKey = ['crm', user?.id, 'sales-regions'];

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: [...cacheKey, [...permissions].sort().join('|'), page],
    enabled: !authLoading && !!user && !!profile?.is_active && hasPermission('settings.view'),
    queryFn: () => loadSalesRegions(supabase, page),
  });
  const regions: SalesRegion[] = data?.rows ?? [];

  const createMutation = useMutation({
    mutationFn: async ({ name, code }: { name: string; code: string }) => {
      if (!user || !profile?.is_active || !hasPermission('settings.update')) throw new Error('Permission denied.');
      const { data, error } = await supabase
        .from('sales_regions')
        .insert({ name: name.trim(), code: code.trim().toUpperCase(), is_active: true })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKey });
      setPage(1);
      setName('');
      setCode('');
      setIsCreating(false);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create sales region');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!user || !profile?.is_active || !hasPermission('settings.update')) throw new Error('Permission denied.');
      await setSalesRegionActive(supabase, id, is_active);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKey });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    createMutation.mutate({ name, code });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#eef2ff] text-[#4361ee] border border-indigo-100">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Sales Regions & Territories</h3>
            <p className="text-xs text-slate-500">
              Configure geographic and functional territories for sales hierarchy assignment and routing.
            </p>
          </div>
        </div>

        {hasPermission('settings.update') && (
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4361ee] hover:bg-[#3a5bf0] text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Sales Region</span>
          </button>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">New Region</span>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Region Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Asia Pacific or Western Territory"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Region Code *
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. APAC, NA-WEST, EMEA"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 uppercase focus:outline-hidden focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 bg-[#4361ee] hover:bg-[#3a5bf0] text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 transition"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Region'}
            </button>
          </div>
        </form>
      )}

      {/* Region Table / Cards */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading && (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading regions...
          </div>
        )}

        {loadError && <p role="alert" className="p-4 text-red-600">{loadError.message} <button onClick={() => void refetch()}>Retry</button></p>}
        {toggleMutation.error && <p role="alert" className="p-4 text-red-600">{toggleMutation.error.message}</p>}
        {!isLoading && !loadError && regions.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No sales regions defined yet. Click "Add Sales Region" to create the first territory.
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {regions.map((reg) => (
            <div
              key={reg.id}
              className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/80 transition"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {reg.code}
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{reg.name}</h4>
                  <span className="text-[11px] text-slate-500">
                    Created {new Date(reg.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                    reg.is_active
                      ? 'bg-[#eef2ff] text-[#4361ee] border border-indigo-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {reg.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {reg.is_active ? 'Active' : 'Inactive'}
                </span>

                {hasPermission('settings.update') && (
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: reg.id, is_active: !reg.is_active })}
                    className="text-xs text-slate-600 hover:text-slate-900 transition px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50"
                  >
                    {reg.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <nav aria-label="Sales region pagination" className="flex gap-4 text-sm"><button disabled={page === 1 || isLoading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {data?.count ?? 0} regions</span><button disabled={isLoading || page * 20 >= (data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</button></nav>
    </div>
  );
}
