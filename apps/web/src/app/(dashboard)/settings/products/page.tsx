'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useAuth } from '@/components/providers/auth-provider';
import { useProducts } from '@/hooks/use-products';
import { ProductModal } from '@/components/settings/products/product-modal';
import { ProductUsageModal } from '@/components/settings/products/product-usage-modal';
import { toggleProductActive, deleteProduct } from '@/app/(dashboard)/settings/products/actions';
import type { ProductRecord } from '@/types/products';
import {
  Package,
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  History,
  CheckCircle2,
  XCircle,
  Tag,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [usageProduct, setUsageProduct] = useState<ProductRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useProducts({
    page,
    pageSize,
    search,
    category,
    type,
    status,
  });

  const products = data?.products || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleEdit = (prod: ProductRecord) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (prod: ProductRecord) => {
    setActionError(null);
    const res = await toggleProductActive(prod.id, !prod.is_active);
    if (res.error) {
      setActionError(res.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
    }
  };

  const handleDelete = async (prod: ProductRecord) => {
    if (!window.confirm(`Are you sure you want to delete "${prod.name}" (${prod.sku})?`)) return;
    setActionError(null);
    const res = await deleteProduct(prod.id);
    if (res.error) {
      setActionError(res.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Product Catalog & Price Books"
        subtitle="Manage master sales products, service offerings, standard pricing, and custom price books."
        actions={
          hasPermission('products.create') ? (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          ) : undefined
        }
      />

      <PermissionGate action="products.view" showAccessDenied>
        <div className="space-y-4">
          {/* Top Sub-Navigation Tabs */}
          <div className="flex border-b border-slate-200">
            <Link
              href="/settings/products"
              className="inline-flex items-center gap-2 border-b-2 border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-800"
            >
              <Package className="h-4 w-4" />
              <span>Products ({totalCount})</span>
            </Link>
            <Link
              href="/settings/products/price-books"
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              <BookOpen className="h-4 w-4" />
              <span>Price Books</span>
            </Link>
          </div>

          {actionError && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{actionError}</span>
              </div>
              <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-800 text-xs">
                Dismiss
              </button>
            </div>
          )}

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by SKU, name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Types</option>
                <option value="product">Products</option>
                <option value="service">Services</option>
                <option value="subscription">Subscriptions</option>
              </select>

              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Products Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading catalog products...</div>
            ) : isError ? (
              <div className="py-12 text-center text-xs text-red-500">Failed to load products.</div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No Products Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {search ? 'Try adjusting your search query or filters.' : 'Get started by creating your organization’s first sales product or service.'}
                </p>
                {hasPermission('products.create') && !search && (
                  <button
                    onClick={handleCreate}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-600 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add First Product</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">SKU / Code</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Default Price</th>
                      <th className="py-3 px-4 text-center">Tax (%)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{p.sku}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {p.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium">
                            <Tag className="h-3 w-3" />
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 capitalize">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            p.type === 'product' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            p.type === 'service' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {p.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {p.currency} {Number(p.default_price).toFixed(2)}
                          <span className="text-[10px] text-slate-400 block font-normal">per {p.unit_of_measure}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">
                          {p.tax_rate ? `${p.tax_rate}%` : '0%'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => hasPermission('products.update') && handleToggleActive(p)}
                            disabled={!hasPermission('products.update')}
                            title={p.is_active ? 'Click to deactivate' : 'Click to activate'}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                              p.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {p.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            <span>{p.is_active ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setUsageProduct(p)}
                              title="View Usage History"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                            {hasPermission('products.update') && (
                              <button
                                onClick={() => handleEdit(p)}
                                title="Edit Product"
                                className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-800 transition"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {hasPermission('products.delete') && (
                              <button
                                onClick={() => handleDelete(p)}
                                title="Delete Product"
                                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-600">
                <div>
                  Showing <span className="font-semibold">{(page - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold">{Math.min(page * pageSize, totalCount)}</span> of{' '}
                  <span className="font-semibold">{totalCount}</span> products
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-slate-300 p-1 hover:bg-white transition disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-medium">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-slate-300 p-1 hover:bg-white transition disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          product={editingProduct}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['products-list'] });
            refetch();
          }}
        />

        <ProductUsageModal
          isOpen={!!usageProduct}
          onClose={() => setUsageProduct(null)}
          product={usageProduct}
        />
      </PermissionGate>
    </PageContainer>
  );
}
