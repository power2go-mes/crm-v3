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
    <div className="w-full bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8faff] border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider select-none">
              {onSelectRow && (
                <th scope="col" className="w-12 px-5 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAllChange}
                    className="h-4 w-4 rounded-md border-slate-300 bg-white text-[#4361ee] focus:ring-[#4361ee] transition cursor-pointer"
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
                    className={`px-5 py-4 whitespace-nowrap text-xs font-bold text-slate-600 ${col.className || ''}`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort((col.accessorKey as string) || col.id)}
                        className="inline-flex items-center gap-1.5 hover:text-[#4361ee] transition group focus:outline-none"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5 text-[#4361ee]" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-[#4361ee]" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition" />
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

          <tbody className="divide-y divide-slate-100/80 text-slate-800">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, rIdx) => (
                <tr key={`skel-${rIdx}`} className="animate-pulse">
                  {onSelectRow && (
                    <td className="px-5 py-4 text-center">
                      <div className="h-4 w-4 bg-slate-100 rounded-md mx-auto" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={`skel-td-${col.id}`} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded-md w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectRow ? 1 : 0)} className="px-5 py-20 text-center">
                  {emptyState || (
                    <div className="text-slate-400 font-medium text-xs">No records found.</div>
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
                    className={`group transition hover:bg-[#f8faff] ${
                      isSelected ? 'bg-[#eef2ff]' : ''
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {onSelectRow && (
                      <td
                        className="px-5 py-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onSelectRow(id, e.target.checked)}
                          className="h-4 w-4 rounded-md border-slate-300 bg-white text-[#4361ee] focus:ring-[#4361ee] transition cursor-pointer"
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
