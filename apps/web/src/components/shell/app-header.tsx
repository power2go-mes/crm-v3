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
    <header className="min-h-16 h-16 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs px-4 sm:px-6">
      <div className="flex h-full w-full items-center justify-between gap-4">
        {/* Left Side: Mobile Menu Button & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open mobile navigation"
            className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            {isDesktopCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          {/* Dynamic Breadcrumbs */}
          <div className="hidden sm:block min-w-0 truncate">
            <Breadcrumbs />
          </div>
        </div>

        {/* Right Side: Notifications & User Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Notification Center */}
          <NotificationCenter />

          {/* User Profile Menu */}
          <UserProfileMenu />
        </div>
      </div>
    </header>
  );
}
