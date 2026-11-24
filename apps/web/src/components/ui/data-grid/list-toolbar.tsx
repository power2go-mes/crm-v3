'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RotateCw,
  Filter,
  LayoutGrid,
  Columns3,
  SplitSquareVertical,
  Plus,
  Pin,
  MoreVertical,
  Download,
  Table as TableIcon,
  PieChart,
} from 'lucide-react';
import type { ViewMode } from '@/types/leads';

interface ListToolbarProps {
  title?: string;
  subtitle?: string;
  viewType?: string;
  viewTypeOptions?: { label: string; value: string }[];
  onViewTypeChange?: (viewType: string) => void;
  viewMode?: ViewMode;
  showLeadViews?: boolean;
  showKanban?: boolean;
  onViewModeChange?: (viewMode: ViewMode) => void;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (search: string) => void;
  onReload?: () => void;
  onFilterToggle?: () => void;
  isFilterOpen?: boolean;
  activeFilterCount?: number;
  onNewClick?: () => void;
  newButtonLabel?: string;
  canCreate?: boolean;
  onExportAll?: () => void;
  onPinClick?: () => void;
  pinned?: boolean;
  pinPending?: boolean;
}

export function ListToolbar({
  title,
  subtitle,
  viewType,
  viewTypeOptions,
  onViewTypeChange,
  viewMode,
  showLeadViews = true,
  showKanban = true,
  onViewModeChange,
  searchValue = '',
  searchPlaceholder,
  onSearchChange,
  onReload,
  onFilterToggle,
  isFilterOpen = false,
  activeFilterCount = 0,
  onNewClick,
  newButtonLabel = 'New',
  canCreate = true,
  onExportAll,
  onPinClick, pinned = false, pinPending = false,
}: ListToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  // 500ms debounce on search
  useEffect(() => {
    if (localSearch === searchValue) return;
    const timer = setTimeout(() => {
      onSearchChange?.(localSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearch, searchValue, onSearchChange]);

  // Keep local search in sync if external searchValue changes
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Title + View Type Selector */}
        {(title || onViewTypeChange) && (
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                {title && <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>}
                {onViewTypeChange && (
                  <div className="relative">
                    <select
                      value={viewType}
                      onChange={(e) => onViewTypeChange(e.target.value)}
                      className="text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md px-2.5 py-1 pr-7 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer transition appearance-none"
                    >
                      {viewTypeOptions ? (
                        viewTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="all">All Items</option>
                          <option value="recently_viewed">Recently Viewed</option>
                          <option value="recently_created">Recently Created</option>
                          <option value="recently_modified">Recently Modified</option>
                          <option value="oldest_first">Oldest First</option>
                          <option value="converted">Converted Lead</option>
                        </>
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                )}
                {onPinClick && (
                  <button
                    type="button"
                    title={pinned ? 'Unpin default view' : 'Set as default view'}
                    aria-pressed={pinned}
                    onClick={onPinClick}
                    disabled={pinPending}
                    className="hidden sm:block p-1 text-slate-400 hover:text-emerald-800 rounded transition disabled:opacity-50"
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 truncate hidden sm:block">{subtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Right Side: Search + Control Icons + New Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input with 500ms debounce */}
          <div className="relative hidden sm:block w-44 sm:w-60">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder || 'Search'}
              className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-md placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-200 focus:ring-1 focus:ring-emerald-500 transition"
            />
            <button type="button" title="Search" aria-label="Search"
              onClick={() => onSearchChange?.(localSearch)}
              className="absolute left-2.5 top-2 text-slate-500">
              <Search className="h-3.5 w-3.5" />
            </button>
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Action Icon Cluster */}
          <div className="flex items-center gap-1">
            {/* Reload Button */}
            <button
              type="button"
              onClick={onReload}
              title="Reload list"
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={onFilterToggle}
              title="Toggle filters"
              className={`relative p-1.5 rounded-md transition ${
                isFilterOpen || activeFilterCount > 0
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* View Switcher Dropdown */}
            {viewType !== 'converted' && onViewModeChange && <div className="relative">
              <button
                type="button"
                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                title="Switch layout"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition flex items-center gap-1"
              >
                {viewMode === 'table' && <TableIcon className="h-4 w-4" />}
                {viewMode === 'kanban' && <Columns3 className="h-4 w-4" />}
                {viewMode === 'split' && <SplitSquareVertical className="h-4 w-4" />}
                {viewMode === 'card' && <LayoutGrid className="h-4 w-4" />}
                {viewMode === 'chart' && <PieChart className="h-4 w-4" />}
              </button>

              {isViewDropdownOpen && (
                <div
                  className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30"
                  onClick={() => setIsViewDropdownOpen(false)}
                >
                  {showLeadViews && (
                    <button
                      onClick={() => onViewModeChange?.('chart')}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                        viewMode === 'chart'
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <PieChart className="h-3.5 w-3.5" />
                      <span>Chart View</span>
                    </button>
                  )}
                  <button
                    onClick={() => onViewModeChange?.('table')}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                      viewMode === 'table'
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    <span>List</span>
                  </button>
                  {showLeadViews && (
                    <button
                      onClick={() => onViewModeChange?.('card')}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                        viewMode === 'card'
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span>Card</span>
                    </button>
                  )}
                  <button
                    onClick={() => onViewModeChange?.('split')}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                      viewMode === 'split'
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <SplitSquareVertical className="h-3.5 w-3.5" />
                    <span>Split View</span>
                  </button>
                  {showKanban && (
                    <button
                      onClick={() => onViewModeChange?.('kanban')}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                        viewMode === 'kanban'
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Columns3 className="h-3.5 w-3.5" />
                      <span>Kanban View</span>
                    </button>
                  )}
                </div>
              )}
            </div>}

            {/* Actions Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                title="More actions"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {isActionsOpen && (
                <div
                  className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30"
                  onClick={() => setIsActionsOpen(false)}
                >
                  {onExportAll && (
                    <button
                      onClick={onExportAll}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                      <span>Export All</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Primary Action Button */}
          {canCreate && onNewClick && (
            <button
              type="button"
              onClick={onNewClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-600 active:bg-emerald-600 rounded-md shadow-xs transition"
            >
              <span>{newButtonLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
