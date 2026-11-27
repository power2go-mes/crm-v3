'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  usePriceBooks,
  usePriceBookEntries,
} from '@/hooks/use-price-books';
import {
  deletePriceBook,
  deletePriceBookEntry,
} from '@/app/(dashboard)/settings/products/actions';
import { useProducts } from '@/hooks/use-products';
import { PriceBookModal } from '@/components/settings/products/price-book-modal';
import { PriceBookEntryModal } from '@/components/settings/products/price-book-entry-modal';
import type { PriceBookRecord, PriceBookEntryRecord, ProductRecord } from '@/types/products';
import {
  BookOpen,
  Plus,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Search,
  Tag,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

export default function PriceBooksPage() {
  const { data: priceBooks = [], isLoading: isLoadingBooks, refetch: refetchBooks } = usePriceBooks();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  // Default to standard price book or first price book once loaded
  const activeBookId = selectedBookId || priceBooks.find((b) => b.is_standard)?.id || priceBooks[0]?.id;
  const currentBook = priceBooks.find((b) => b.id === activeBookId);

  const { data: entries = [], isLoading: isLoadingEntries, refetch: refetchEntries } = usePriceBookEntries(activeBookId);
  const { data: productsData } = useProducts({ pageSize: 100 });
  const allProducts = productsData?.products || [];

  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<PriceBookRecord | null>(null);

  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PriceBookEntryRecord | null>(null);

  const [entrySearch, setEntrySearch] = useState('');

  const filteredEntries = entries.filter((e) => {
    if (!entrySearch.trim()) return true;
    const term = entrySearch.toLowerCase();
    return (
      e.product?.name.toLowerCase().includes(term) ||
      e.product?.sku.toLowerCase().includes(term) ||
      e.product?.category.toLowerCase().includes(term)
    );
  });

  const handleDeleteBook = async (book: PriceBookRecord) => {
    if (book.is_standard) {
      alert('The Standard Price Book cannot be deleted.');
      return;
    }
    if (confirm(`Are you sure you want to delete "${book.name}"? This will delete all its pricing entries.`)) {
      const res = await deletePriceBook(book.id);
      if (res.error) {
        alert(res.error);
      } else {
        await refetchBooks();
        if (selectedBookId === book.id) {
          setSelectedBookId(null);
        }
      }
    }
  };

  const handleDeleteEntry = async (entry: PriceBookEntryRecord) => {
    if (confirm(`Remove "${entry.product?.name || 'this item'}" from this price book?`)) {
      const res = await deletePriceBookEntry(entry.id);
      if (res.error) {
        alert(res.error);
      } else {
        await refetchEntries();
      }
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Price Books & Catalogs"
        subtitle="Manage standard base pricing and tiered, segmented, or seasonal price books."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/settings/products"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Products</span>
            </Link>
            <PermissionGate action="price_books.create">
              <button
                type="button"
                onClick={() => {
                  setEditingBook(null);
                  setBookModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#4361ee]"
              >
                <Plus className="h-4 w-4" />
                <span>New Price Book</span>
              </button>
            </PermissionGate>
          </div>
        }
      />

      <PermissionGate action="price_books.view" showAccessDenied>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Left Column: Price Books List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Price Books ({priceBooks.length})
              </h3>
            </div>

            {isLoadingBooks ? (
              <div className="space-y-2">
                <div className="h-16 rounded-xl bg-slate-200 animate-pulse" />
                <div className="h-16 rounded-xl bg-slate-200 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-2">
                {priceBooks.map((book) => {
                  const isSelected = book.id === activeBookId;
                  return (
                    <div
                      key={book.id}
                      onClick={() => setSelectedBookId(book.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? 'border-indigo-100 bg-[#eef2ff]/50 dark:border-indigo-100/50 dark:bg-[#4361ee]/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300  '
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900">
                              {book.name}
                            </h4>
                            {book.is_standard && (
                              <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#4361ee] dark:bg-[#4361ee]/40 dark:text-[#4361ee]">
                                Standard
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                            {book.description || 'No description'}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                          {book.currency}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          {book.is_active ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-[#4361ee]" />
                          ) : (
                            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                          )}
                          {book.is_active ? 'Active' : 'Inactive'}
                        </span>

                        {(book.effective_from || book.effective_to) && (
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Calendar className="h-3 w-3" />
                            {book.effective_from || '—'} to {book.effective_to || '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Price Book Details & Entries */}
          <div className="lg:col-span-3 space-y-4">
            {currentBook ? (
              <>
                {/* Header banner of current price book */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">
                          {currentBook.name}
                        </h2>
                        {currentBook.is_standard && (
                          <span className="rounded bg-[#eef2ff] px-2 py-0.5 text-xs font-semibold text-[#4361ee] dark:bg-[#4361ee]/40 dark:text-[#4361ee]">
                            Base Catalog
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            currentBook.is_active
                              ? 'bg-[#eef2ff] text-[#4361ee] dark:bg-emerald-950/40 dark:text-[#4361ee]'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 '
                          }`}
                        >
                          {currentBook.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {currentBook.description || 'Standard currency price list for enterprise sales.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <PermissionGate action="price_books.update">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBook(currentBook);
                            setBookModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Edit Book</span>
                        </button>
                      </PermissionGate>

                      {!currentBook.is_standard && (
                        <PermissionGate action="price_books.delete">
                          <button
                            type="button"
                            onClick={() => handleDeleteBook(currentBook)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </PermissionGate>
                      )}

                      <PermissionGate action="price_books.update">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntry(null);
                            setEntryModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#4361ee]"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Product Entry</span>
                        </button>
                      </PermissionGate>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-slate-400">Currency</span>
                      <p className="font-mono font-bold text-slate-800">
                        {currentBook.currency}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Entries</span>
                      <p className="font-bold text-slate-800">
                        {entries.length} items
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Valid From</span>
                      <p className="font-medium text-slate-800">
                        {currentBook.effective_from || 'Indefinite'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Valid To</span>
                      <p className="font-medium text-slate-800">
                        {currentBook.effective_to || 'Indefinite'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Entries table filter */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Search entries in this price book..."
                      value={entrySearch}
                      onChange={(e) => setEntrySearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-100 focus:outline-none focus:ring-1 focus:ring-[#4361ee] dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Table of Entries */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Standard Default</th>
                        <th className="px-4 py-3 text-right">Price Book Price</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {isLoadingEntries ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            Loading pricing entries...
                          </td>
                        </tr>
                      ) : filteredEntries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                            No pricing entries configured in this price book yet.
                          </td>
                        </tr>
                      ) : (
                        filteredEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {entry.product?.name || 'Unknown Product'}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">
                              {entry.product?.sku}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {entry.product?.category}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                              {entry.product?.default_price != null
                                ? `${currentBook.currency} ${Number(entry.product.default_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                              {currentBook.currency} {Number(entry.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  entry.is_active
                                    ? 'bg-[#eef2ff] text-[#4361ee] dark:bg-emerald-950/40 dark:text-[#4361ee]'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 '
                                }`}
                              >
                                {entry.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <PermissionGate action="price_books.update">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEntry(entry);
                                      setEntryModalOpen(true);
                                    }}
                                    className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    title="Edit Price Entry"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                </PermissionGate>

                                <PermissionGate action="price_books.update">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(entry)}
                                    className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    title="Remove from Price Book"
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
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
                <h4 className="mt-2 text-sm font-semibold text-slate-800">
                  No Price Book Selected
                </h4>
                <p className="text-xs text-slate-500">
                  Select a price book from the left or create a new one.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Price Book Edit / Create Modal */}
        {bookModalOpen && (
          <PriceBookModal
            isOpen={bookModalOpen}
            onClose={() => setBookModalOpen(false)}
            priceBook={editingBook}
            onSuccess={() => {}}
          />
        )}

        {/* Price Book Entry Modal */}
        {entryModalOpen && currentBook && (
          <PriceBookEntryModal
            isOpen={entryModalOpen}
            onClose={() => setEntryModalOpen(false)}
            priceBook={currentBook}
            entry={editingEntry}
            products={allProducts}
            onSuccess={() => {}}
          />
        )}
      </PermissionGate>
    </PageContainer>
  );
}
