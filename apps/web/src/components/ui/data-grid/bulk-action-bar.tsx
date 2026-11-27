'use client';

import React from 'react';
import { Check, X, Download, Trash2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExportSelected?: () => void;
  onBulkDelete?: () => void;
  canDelete?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onExportSelected,
  onBulkDelete,
  canDelete = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2.5 flex-wrap px-5 py-3 bg-[#eef2ff] border-b border-indigo-100/70 text-xs text-[#4361ee] font-semibold transition animate-in fade-in duration-150 rounded-t-3xl">
      {/* Select All on Page / All Records */}
      <button
        type="button"
        onClick={onSelectAll}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4361ee] text-white rounded-xl shadow-2xs font-bold transition hover:bg-[#3a5bf0]"
      >
        <Check className="h-3.5 w-3.5" />
        <span>Select All ({totalCount})</span>
      </button>

      {/* Unselect All */}
      <button
        type="button"
        onClick={onClearSelection}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50 rounded-xl font-semibold transition"
      >
        <X className="h-3.5 w-3.5" />
        <span>Unselect ({selectedCount})</span>
      </button>

      {/* Export Selected */}
      {onExportSelected && (
        <button
          type="button"
          onClick={onExportSelected}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#4361ee] border border-indigo-200 hover:bg-indigo-50 rounded-xl font-semibold transition"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Selected</span>
        </button>
      )}

      {/* Bulk Delete */}
      {canDelete && onBulkDelete && (
        <button
          type="button"
          onClick={onBulkDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-xl font-semibold transition ml-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Bulk Delete</span>
        </button>
      )}
    </div>
  );
}
