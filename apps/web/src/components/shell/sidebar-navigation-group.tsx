'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NavIcon } from './nav-icon';
import { isNavItemActive, type NavGroupConfig, type NavItemConfig } from '@/lib/navigation/config';

interface SidebarNavigationGroupProps {
  group: NavGroupConfig;
  isCollapsed?: boolean;
  onNavigate?: () => void;
  collapsible?: boolean;
}

export function SidebarNavigationGroup({
  group,
  isCollapsed = false,
  onNavigate,
}: SidebarNavigationGroupProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);

  if (group.items.length === 0) return null;

  const hasMultipleItems = group.items.length > 1;
  const isSingleItem = group.items.length === 1;
  const hasGroupActiveItem = group.items.some((i) => isNavItemActive(pathname, i));

  // If collapsed mode:
  if (isCollapsed) {
    if (isSingleItem) {
      const single = group.items[0];
      const isActive = isNavItemActive(pathname, single);
      return (
        <div className="relative group/pop flex justify-center py-1">
          <Link
            href={single.href}
            onClick={onNavigate}
            title={single.label}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-150 ${
              isActive
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-300 font-bold shadow-2xs'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <NavIcon
              name={single.iconName}
              className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}
            />
          </Link>
          <div
            role="tooltip"
            className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-white text-slate-800 text-xs font-semibold rounded-xl shadow-xl border border-slate-200 opacity-0 pointer-events-none group-hover/pop:opacity-100 transition-opacity z-50 whitespace-nowrap"
          >
            {single.label}
          </div>
        </div>
      );
    }

    // Multiple items in a group (e.g. Sales, People, Analytics, Schedule)
    const primaryItem = group.items[0];
    const groupIcon = primaryItem.iconName;

    return (
      <div
        className="relative flex justify-center py-1 group/flyout"
        onMouseEnter={() => setIsFlyoutOpen(true)}
        onMouseLeave={() => setIsFlyoutOpen(false)}
      >
        <button
          type="button"
          onClick={() => setIsFlyoutOpen(!isFlyoutOpen)}
          className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-150 ${
            hasGroupActiveItem
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-300 font-bold shadow-2xs'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <NavIcon
            name={groupIcon}
            className={`w-5 h-5 shrink-0 ${hasGroupActiveItem ? 'text-emerald-600' : 'text-slate-500'}`}
          />
        </button>

        {/* Hover / Click Flyout Card with transparent bridge to prevent pointer flicker */}
        {isFlyoutOpen && (
          <div className="absolute left-full top-0 pl-3 z-50 animate-in fade-in duration-150">
            <div className="w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 px-2 uppercase tracking-wider mb-1">
                {group.title || primaryItem.label}
              </div>
              {group.items.map((item) => {
                const isActive = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      setIsFlyoutOpen(false);
                      onNavigate?.();
                    }}
                    className={`block px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-50 text-emerald-600 border border-amber-300 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded Sidebar mode (when open)
  if (isSingleItem) {
    const single = group.items[0];
    const isActive = isNavItemActive(pathname, single);
    return (
      <div className="py-0.5">
        <Link
          href={single.href}
          onClick={onNavigate}
          className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            isActive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <NavIcon
            name={single.iconName}
            className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}
          />
          <span className="font-semibold text-slate-800">{single.label}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-1">
      {/* Category Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
          hasGroupActiveItem
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center space-x-3">
          <NavIcon
            name={group.items[0].iconName}
            className={`w-4 h-4 shrink-0 ${hasGroupActiveItem ? 'text-emerald-600' : 'text-slate-500'}`}
          />
          <span className="font-bold text-slate-800">{group.title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {/* Sub-items List */}
      {isOpen && (
        <div className="pl-4 pr-1 py-1 space-y-1">
          {group.items.map((item) => {
            const isActive = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                className={`block w-full px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-amber-50 text-emerald-700 border border-amber-300 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
