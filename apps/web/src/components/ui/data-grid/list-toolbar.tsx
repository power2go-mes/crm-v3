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
    <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3.5 transition-colors rounded-t-3xl shadow-2xs">
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
                      className="text-xs font-semibold text-slate-700 bg-[#f8faff] hover:bg-[#f0f4ff] border border-slate-200/80 rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-[#4361ee] cursor-pointer transition appearance-none"
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
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
                    className="hidden sm:block p-1.5 text-slate-400 hover:text-[#4361ee] rounded-lg transition disabled:opacity-50"
                  >
                    <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-[#4361ee] text-[#4361ee]' : ''}`} />
                  </button>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate hidden sm:block">{subtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Right Side: Search + Control Icons + New Button */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Search Input with 500ms debounce */}
          <div className="relative w-full sm:w-56 md:w-64 order-last sm:order-first mt-2 sm:mt-0">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder || 'Search...'}
              className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 bg-[#f8faff] border border-slate-200/70 rounded-xl placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#4361ee]/40 focus:ring-1 focus:ring-[#4361ee] transition"
            />
            <button type="button" title="Search" aria-label="Search"
              onClick={() => onSearchChange?.(localSearch)}
              className="absolute left-2.5 top-2 text-slate-400">
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
          <div className="flex items-center gap-1.5">
            {/* Reload Button */}
            <button
              type="button"
              onClick={onReload}
              title="Reload list"
              className="p-1.5 bg-[#f8faff] hover:bg-slate-100 text-slate-600 rounded-xl transition border border-slate-200/60"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={onFilterToggle}
              title="Toggle filters"
              className={`relative p-1.5 rounded-xl transition border ${
                isFilterOpen || activeFilterCount > 0
                  ? 'bg-[#eef2ff] text-[#4361ee] border-indigo-200 font-bold'
                  : 'bg-[#f8faff] hover:bg-slate-100 text-slate-600 border-slate-200/60'
              }`}
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#4361ee] text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-xs">
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
                className="p-1.5 bg-[#f8faff] hover:bg-slate-100 text-slate-600 rounded-xl transition border border-slate-200/60 flex items-center gap-1"
              >
                {viewMode === 'table' && <TableIcon className="h-4 w-4" />}
                {viewMode === 'kanban' && <Columns3 className="h-4 w-4 text-[#4361ee]" />}
                {viewMode === 'split' && <SplitSquareVertical className="h-4 w-4" />}
                {viewMode === 'card' && <LayoutGrid className="h-4 w-4" />}
                {viewMode === 'chart' && <PieChart className="h-4 w-4" />}
              </button>

              {isViewDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl py-2 z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setIsViewDropdownOpen(false)}
                >
                  <div className="py-1">
                    <button
                      onClick={() => onViewModeChange?.('table')}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition ${
                        viewMode === 'table'
                          ? 'bg-[#eef2ff] text-[#4361ee] font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <TableIcon className="h-4 w-4 text-[#4361ee]" />
                      <span>List / Table</span>
                    </button>
                    {showKanban && (
                      <button
                        onClick={() => onViewModeChange?.('kanban')}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition ${
                          viewMode === 'kanban'
                            ? 'bg-[#eef2ff] text-[#4361ee] font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <Columns3 className="h-4 w-4 text-[#4361ee]" />
                        <span>Kanban Board</span>
                      </button>
                    )}
                    <button
                      onClick={() => onViewModeChange?.('split')}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition ${
                        viewMode === 'split'
                          ? 'bg-[#eef2ff] text-[#4361ee] font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <SplitSquareVertical className="h-4 w-4 text-[#4361ee]" />
                      <span>Split View</span>
                    </button>
                  </div>

                  {showLeadViews && (
                    <div className="py-1">
                      <button
                        onClick={() => onViewModeChange?.('card')}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition ${
                          viewMode === 'card'
                            ? 'bg-[#eef2ff] text-[#4361ee] font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <LayoutGrid className="h-4 w-4 text-emerald-500" />
                        <span>Card Grid</span>
                      </button>
                      <button
                        onClick={() => onViewModeChange?.('chart')}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition ${
                          viewMode === 'chart'
                            ? 'bg-[#eef2ff] text-[#4361ee] font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <PieChart className="h-4 w-4 text-rose-500" />
                        <span>Analytics Chart</span>
                      </button>
                    </div>
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
                className="p-1.5 bg-[#f8faff] hover:bg-slate-100 text-slate-600 rounded-xl transition border border-slate-200/60"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {isActionsOpen && (
                <div
                  className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5 z-30"
                  onClick={() => setIsActionsOpen(false)}
                >
                  {onExportAll && (
                    <button
                      onClick={onExportAll}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 text-left transition font-medium"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                      <span>Export All</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Primary Action Button - CRMHUB Cobalt */}
          {canCreate && onNewClick && (
            <button
              type="button"
              onClick={onNewClick}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#4361ee] hover:bg-[#3a5bf0] active:bg-[#3a5bf0] rounded-xl shadow-md shadow-indigo-500/20 transition active:scale-95"
            >
              <span>{newButtonLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
