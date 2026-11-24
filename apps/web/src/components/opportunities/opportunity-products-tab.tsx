'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOpportunityLineItems } from '@/hooks/use-opportunity-line-items';
import {
  deleteOpportunityLineItem,
  setOpportunitySyncMode,
} from '@/app/(dashboard)/opportunities/[id]/products/actions';
import { AddOpportunityProductModal } from '@/components/opportunities/add-opportunity-product-modal';
import type { OpportunityLineItemRecord } from '@/types/quotes';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  Tag,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { PermissionGate } from '@/components/auth/permission-gate';

interface OpportunityProductsTabProps {
  opportunityId: string;
  opportunityAmount: number;
  priceSyncMode?: 'manual' | 'synced';
  priceBookId?: string | null;
  currency?: string;
  onOpportunityUpdated?: () => void;
}

export function OpportunityProductsTab({
  opportunityId,
  opportunityAmount,
  priceSyncMode = 'manual',
  priceBookId,
  currency = 'INR',
  onOpportunityUpdated,
}: OpportunityProductsTabProps) {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading, refetch } = useOpportunityLineItems(opportunityId);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OpportunityLineItemRecord | null>(null);
  const [isUpdatingSync, setIsUpdatingSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Totals
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  const discountTotal = items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
  const taxTotal = items.reduce((sum, item) => sum + Number(item.tax_amount || 0), 0);
  const lineItemsTotal = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);

  const handleToggleSyncMode = async (newMode: 'manual' | 'synced') => {
    setIsUpdatingSync(true);
    setSyncError(null);
    try {
      const res = await setOpportunitySyncMode(opportunityId, newMode);
      if (res.error) {
        setSyncError(res.error);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
        if (onOpportunityUpdated) onOpportunityUpdated();
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to update sync mode');
    } finally {
      setIsUpdatingSync(false);
    }
  };

  const handleDeleteItem = async (item: OpportunityLineItemRecord) => {
    if (confirm(`Remove "${item.product_name}" from this opportunity?`)) {
      const res = await deleteOpportunityLineItem(item.id, opportunityId);
      if (res.error) {
        alert(res.error);
      } else {
        await refetch();
        await queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
        if (onOpportunityUpdated) onOpportunityUpdated();
      }
    }
  };

  const handleSuccess = async () => {
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
    if (onOpportunityUpdated) onOpportunityUpdated();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics & Sync Mode Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-800 dark:text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Opportunity Line Items ({items.length})
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Manage configured products, unit prices, volume discounts, and calculated deal totals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Mode Toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs dark:bg-slate-800/60">
              <span className="px-2 text-slate-500 font-medium">Deal Amount:</span>
              <button
                type="button"
                disabled={isUpdatingSync}
                onClick={() => handleToggleSyncMode('manual')}
                className={`rounded-md px-2.5 py-1 font-semibold transition ${
                  priceSyncMode === 'manual'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 '
                    : 'text-slate-600 hover:text-slate-900  dark:hover:text-white'
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                disabled={isUpdatingSync}
                onClick={() => handleToggleSyncMode('synced')}
                className={`rounded-md px-2.5 py-1 font-semibold transition ${
                  priceSyncMode === 'synced'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900  dark:hover:text-white'
                }`}
              >
                Synced to Items
              </button>
            </div>

            <PermissionGate action="opportunities.edit">
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-600"
              >
                <Plus className="h-4 w-4" />
                <span>Add Product</span>
              </button>
            </PermissionGate>
          </div>
        </div>

        {syncError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {/* Pricing Summary KPIs */}
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
          <div className="space-y-1 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <span className="text-slate-400 font-medium">Items Subtotal</span>
            <p className="font-mono text-sm font-bold text-slate-800">
              {currency} {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <span className="text-slate-400 font-medium">Total Discount</span>
            <p className="font-mono text-sm font-bold text-red-600 dark:text-red-400">
              - {currency} {discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
            <span className="text-slate-400 font-medium">Total Tax</span>
            <p className="font-mono text-sm font-bold text-slate-800">
              + {currency} {taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-emerald-50/50 p-3 dark:bg-emerald-600/30">
            <div className="flex items-center justify-between">
              <span className="text-emerald-800 dark:text-emerald-600 font-medium">
                {priceSyncMode === 'synced' ? 'Authoritative Amount' : 'Calculated Items Total'}
              </span>
              {priceSyncMode === 'synced' && (
                <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold uppercase text-white">
                  Active Sync
                </span>
              )}
            </div>
            <p className="font-mono text-sm font-bold text-emerald-800 dark:text-emerald-600">
              {currency} {lineItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Table of Line Items */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Product / Description</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3 text-right">Discount</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Line Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading opportunity products...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <Package className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600 dark:text-slate-300">
                    No products added to this deal yet.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Add catalog products to configure line items, calculate totals, and generate quotes.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setIsAddModalOpen(true);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add First Product</span>
                  </button>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {item.product_name}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {item.product_sku || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                    {Number(item.quantity).toLocaleString()} {item.product?.unit_of_measure || ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200">
                    {currency} {Number(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                    {item.discount_percent > 0 ? (
                      <span>
                        {item.discount_percent}% (-{currency} {Number(item.discount_amount).toFixed(2)})
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {item.tax_percent > 0 ? (
                      <span>
                        {item.tax_percent}% (+{currency} {Number(item.tax_amount).toFixed(2)})
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {currency} {Number(item.line_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <PermissionGate action="opportunities.edit">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsAddModalOpen(true);
                          }}
                          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Edit Line Item"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGate>

                      <PermissionGate action="opportunities.edit">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="rounded p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete Line Item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <AddOpportunityProductModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          opportunityId={opportunityId}
          priceBookId={priceBookId}
          currency={currency}
          item={editingItem}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
