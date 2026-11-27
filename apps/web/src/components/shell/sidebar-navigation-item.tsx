'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from './nav-icon';
import { isNavItemActive, type NavItemConfig } from '@/lib/navigation/config';

interface SidebarNavigationItemProps {
  item: NavItemConfig;
  isCollapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNavigationItem({
  item,
  isCollapsed = false,
  onNavigate,
}: SidebarNavigationItemProps) {
  const pathname = usePathname();
  const isActive = isNavItemActive(pathname, item);

  return (
    <div className="relative group">
      <Link
        href={item.href}
        onClick={onNavigate}
        title={isCollapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-center transition-all duration-150 rounded-lg text-xs font-semibold ${
          isActive
            ? 'bg-[#4361ee] text-white shadow-xs font-bold'
            : 'text-slate-600 hover:bg-[#eef2ff] hover:text-emerald-900'
        } ${isCollapsed ? 'justify-center p-2.5 mx-auto' : 'space-x-2.5 px-3 py-1.5'}`}
      >
        <NavIcon
          name={item.iconName}
          className={`shrink-0 ${isCollapsed ? 'w-5 h-5' : 'w-3.5 h-3.5'} ${
            isActive ? 'text-white' : 'text-slate-500 group-hover:text-[#4361ee]'
          }`}
        />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
        {!isCollapsed && item.badge && (
          <span
            className={`ml-auto text-[9px] font-bold px-1.5 py-0.2 rounded ${
              isActive
                ? 'bg-amber-500 text-white font-extrabold shadow-2xs'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>

      {/* Floating tooltip on hover when collapsed */}
      {isCollapsed && (
        <div
          role="tooltip"
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap"
        >
          {item.label}
        </div>
      )}
    </div>
  );
}
