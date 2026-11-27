'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function PaginationBar({
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers
  const pages: (number | string)[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white border-t border-slate-100 text-xs text-slate-500 rounded-b-3xl">
      {/* Records Count & Page Size Selector */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <span>
          Showing <span className="font-bold text-slate-800">{startRecord}</span> to{' '}
          <span className="font-bold text-slate-800">{endRecord}</span> of{' '}
          <span className="font-bold text-slate-800">{totalCount}</span> entries
        </span>

        <div className="flex items-center gap-1.5 sm:ml-2">
          <label htmlFor="pageSizeSelect" className="text-slate-400">
            Per page:
          </label>
          <select
            id="pageSizeSelect"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-xs font-semibold text-slate-700 bg-[#f8faff] border border-slate-200/70 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#4361ee] cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Page Numbers with CRMHUB Blue Active State */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              className={`h-7 w-7 rounded-lg text-xs font-bold transition-all ${
                p === currentPage
                  ? 'bg-[#4361ee] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={`dots-${idx}`} className="px-1 text-slate-300">
              ...
            </span>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
