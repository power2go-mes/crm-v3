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
    <div className="flex items-center gap-2 flex-wrap px-4 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs transition animate-in fade-in duration-150">
      {/* Select All on Page / All Records */}
      <button
        type="button"
        onClick={onSelectAll}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-600 hover:text-white rounded-md font-medium transition"
      >
        <Check className="h-3.5 w-3.5" />
        <span>Select All ({totalCount})</span>
      </button>

      {/* Unselect All */}
      <button
        type="button"
        onClick={onClearSelection}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-600 hover:text-white rounded-md font-medium transition"
      >
        <X className="h-3.5 w-3.5" />
        <span>Unselect ({selectedCount})</span>
      </button>

      {/* Export Selected */}
      {onExportSelected && (
        <button
          type="button"
          onClick={onExportSelected}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-600 hover:text-white rounded-md font-medium transition"
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-300 hover:bg-red-600 hover:text-white rounded-md font-medium transition ml-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Bulk Delete</span>
        </button>
      )}
    </div>
  );
}
