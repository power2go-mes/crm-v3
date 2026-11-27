'use client';

import React, { useState, useEffect } from 'react';
import { ApplicationSidebar } from './application-sidebar';
import { AppHeader } from './app-header';
import { MobileNavigationDrawer } from './mobile-navigation-drawer';

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'finlonexa_crm_sidebar_collapsed';

interface AuthenticatedShellProps {
  children: React.ReactNode;
}

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Restore persistent collapse preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      }
    } catch {
      // localStorage may be unavailable or restricted
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen w-full bg-[#f4f6fa] text-slate-800 overflow-hidden">
      {/* Desktop Fixed/Sticky Sidebar */}
      <div className={`hidden lg:flex h-full shrink-0 ${isCollapsed ? 'z-40' : 'z-20'}`}>
        <ApplicationSidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Mobile Drawer */}
      <MobileNavigationDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Sticky App Header */}
        <AppHeader
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          onToggleDesktopSidebar={toggleCollapse}
          isDesktopCollapsed={isCollapsed}
        />

        {/* Scrollable Main Viewport */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
