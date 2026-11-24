'use client';

import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  width?: string;
}

interface DataGridProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  selectedIds?: string[];
  onSelectRow?: (id: string, selected: boolean) => void;
  onSelectAll?: (selectAll: boolean) => void;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (field: string) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (item: T) => void;
}

export function DataGrid<T>({
  columns,
  data,
  keyExtractor,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  sortField,
  sortDirection,
  onSort,
  isLoading = false,
  emptyState,
  onRowClick,
}: DataGridProps<T>) {
  const allSelected = data.length > 0 && data.every((item) => selectedIds.includes(keyExtractor(item)));
  const isIndeterminate =
    selectedIds.length > 0 && !allSelected && data.some((item) => selectedIds.includes(keyExtractor(item)));

  const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectAll?.(e.target.checked);
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider select-none">
              {onSelectRow && (
                <th scope="col" className="w-12 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAllChange}
                    className="h-4 w-4 rounded border-slate-300 bg-slate-100 text-emerald-800 focus:ring-emerald-500 focus:ring-offset-white transition"
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {columns.map((col) => {
                const isSorted = sortField === (col.accessorKey as string) || sortField === col.id;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    style={{ width: col.width }}
                    className={`px-4 py-3.5 whitespace-nowrap ${col.className || ''}`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort((col.accessorKey as string) || col.id)}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900 transition group focus:outline-none"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-emerald-600" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-600 transition" />
                        )}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-800">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, rIdx) => (
                <tr key={`skel-${rIdx}`} className="animate-pulse">
                  {onSelectRow && (
                    <td className="px-4 py-3.5 text-center">
                      <div className="h-4 w-4 bg-slate-100 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={`skel-td-${col.id}`} className="px-4 py-3.5">
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectRow ? 1 : 0)} className="px-4 py-16 text-center">
                  {emptyState || (
                    <div className="text-slate-500 text-sm">No records found.</div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(item)}
                    className={`group transition hover:bg-slate-50 ${
                      isSelected ? 'bg-emerald-50' : ''
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {onSelectRow && (
                      <td
                        className="px-4 py-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onSelectRow(id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 bg-slate-100 text-emerald-800 focus:ring-emerald-500 focus:ring-offset-white transition"
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                    )}

                    {columns.map((col) => {
                      const cellContent = col.cell
                        ? col.cell(item)
                        : col.accessorKey
                        ? (item as any)[col.accessorKey]
                        : null;

                      return (
                        <td
                          key={col.id}
                          className={`px-4 py-3.5 whitespace-nowrap ${col.className || ''}`}
                        >
                          {cellContent ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
