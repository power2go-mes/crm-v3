'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
} from 'lucide-react';
import { SidebarNavigationGroup } from './sidebar-navigation-group';
import { getAuthorizedNavigation } from '@/lib/navigation/config';
import { useAuth } from '@/components/providers/auth-provider';

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
        isCollapsed ? 'w-16' : 'w-64'
      } ${className}`}
    >
      {/* Brand Header */}
      <div className="shrink-0 p-3.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <Link
            href="/"
            onClick={onNavigate}
            title={isCollapsed ? "FINLONEXA CRM v3" : undefined}
            className={`flex items-center gap-2.5 font-bold text-slate-900 overflow-hidden group ${
              isCollapsed ? 'mx-auto justify-center' : ''
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700 transition">
              <Building2 className="h-4 w-4" />
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

          {/* Desktop Collapse Toggle */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Nav Groups Container */}
      <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar ${
        isCollapsed ? 'px-1.5 py-3 space-y-2' : 'px-2.5 py-4 space-y-4'
      }`}>
        {mounted &&
          authorizedGroups.map((group) => (
            <SidebarNavigationGroup
              key={group.id}
              group={group}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
              collapsible={false}
            />
          ))}
      </nav>

      {/* Footer Branding */}
      <div className="shrink-0 border-t border-slate-100 px-3 py-2.5 text-[10px] text-slate-400 bg-slate-50/30">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">FINLONEXA CRM</span>
            <span className="font-mono text-[9px] text-slate-400">v3.0</span>
          </div>
        ) : (
          <div className="text-center font-mono text-[9px] text-slate-400">v3</div>
        )}
      </div>
    </aside>
  );
}
