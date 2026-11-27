'use client';

import React from 'react';
import { Menu, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { UserProfileMenu } from './user-profile-menu';
import { Breadcrumbs } from './breadcrumbs';
import { NotificationCenter } from './notification-center';

interface AppHeaderProps {
  onOpenMobileNav: () => void;
  onToggleDesktopSidebar: () => void;
  isDesktopCollapsed: boolean;
}

export function AppHeader({
  onOpenMobileNav,
  onToggleDesktopSidebar,
  isDesktopCollapsed,
}: AppHeaderProps) {
  return (
    <header className="min-h-16 h-16 bg-white border-b border-slate-100/90 sticky top-0 z-30 shadow-2xs px-4 sm:px-8">
      <div className="flex h-full w-full items-center justify-between gap-4">
        {/* Left Side: Mobile Menu Button & Search Bar */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open mobile navigation"
            className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-[#f8faff] text-slate-500 hover:text-[#4361ee] hover:border-indigo-100 transition"
          >
            {isDesktopCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          {/* Clean Pill Search Bar matching CRMHUB */}
          <div className="relative max-w-md w-full hidden sm:block">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search in CRM..."
              className="w-full pl-9 pr-4 py-2 bg-[#f4f6fa] border-none rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4361ee]/20 focus:bg-white transition"
            />
          </div>

          {/* Dynamic Breadcrumbs */}
          <div className="hidden lg:block min-w-0 truncate text-xs text-slate-400">
            <Breadcrumbs />
          </div>
        </div>

        {/* Right Side: Notifications & User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Notification Center */}
          <NotificationCenter />

          {/* User Profile Menu */}
          <UserProfileMenu />
        </div>
      </div>
    </header>
  );
}
