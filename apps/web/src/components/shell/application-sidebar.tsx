'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
} from 'lucide-react';
import { SidebarNavigationGroup } from './sidebar-navigation-group';
import { getAuthorizedNavigation } from '@/lib/navigation/config';
import { useAuth } from '@/components/providers/auth-provider';

// Exact MES-power2go custom Collapse / Expand icon
function MesCollapseIcon({ isCollapsed }: { isCollapsed: boolean }) {
  if (isCollapsed) {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-700 hover:border-emerald-600 hover:text-emerald-600 transition shadow-2xs">
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 17l5-5-5-5" />
          <path d="M6 17l5-5-5-5" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2.5 text-slate-600 hover:text-slate-900 font-semibold text-xs transition">
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 17l-5-5 5-5" />
        <path d="M18 17l-5-5 5-5" />
      </svg>
      <span>Collapse</span>
    </div>
  );
}

interface ApplicationSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
  onNavigate?: () => void;
}

export function ApplicationSidebar({
  isCollapsed,
  onToggleCollapse,
  className = '',
  onNavigate,
}: ApplicationSidebarProps) {
  const { permissions, isSuperAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const authorizedGroups = getAuthorizedNavigation(permissions, isSuperAdmin);

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col shrink-0 select-none transition-all duration-200 ease-in-out h-full ${
        isCollapsed ? 'w-20' : 'w-64'
      } ${className}`}
    >
      {/* Brand Header */}
      <div className={`shrink-0 p-4 border-b border-slate-100 bg-white ${isCollapsed ? 'flex justify-center' : ''}`}>
        <Link
          href="/"
          onClick={onNavigate}
          title={isCollapsed ? 'FINLONEXA CRM v3' : undefined}
          className={`flex items-center gap-3 font-bold text-slate-900 group ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700 transition">
            <Building2 className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight leading-none text-slate-900 truncate">
                FINLONEXA
              </span>
              <span className="text-[9px] font-extrabold text-orange-600 uppercase tracking-widest leading-normal">
                CRM v3
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav Groups Container */}
      <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar ${
        isCollapsed ? 'px-2 py-4 space-y-2' : 'px-3 py-4 space-y-2'
      }`}>
        {mounted &&
          authorizedGroups.map((group) => (
            <SidebarNavigationGroup
              key={group.id}
              group={group}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          ))}
      </nav>

      {/* Footer: MES-power2go exact Collapse Toggle */}
      <div className={`shrink-0 border-t border-slate-100 p-3 bg-white ${
        isCollapsed ? 'flex justify-center' : ''
      }`}>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center py-2.5 transition rounded-xl ${
            isCollapsed ? 'justify-center' : 'px-3.5 hover:bg-slate-50'
          }`}
        >
          <MesCollapseIcon isCollapsed={isCollapsed} />
        </button>
      </div>
    </aside>
  );
}
