'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SidebarNavigationItem } from './sidebar-navigation-item';
import type { NavGroupConfig } from '@/lib/navigation/config';

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
  collapsible = false,
}: SidebarNavigationGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (group.items.length === 0) return null;

  const hasTitle = Boolean(group.title && group.title.trim().length > 0);

  return (
    <div className={hasTitle ? 'space-y-1' : 'space-y-0.5'}>
      {!isCollapsed ? (
        hasTitle ? (
          collapsible ? (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-between px-3 mb-1 text-left select-none text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition"
            >
              <span>{group.title}</span>
              {isOpen ? (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-400" />
              )}
            </button>
          ) : (
            <div className="mb-1.5 px-3 text-[9px] font-black uppercase tracking-widest text-slate-400 select-none">
              {group.title}
            </div>
          )
        ) : null
      ) : (
        hasTitle ? <div className="my-1.5 border-t border-slate-100" /> : null
      )}

      {isOpen && (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <SidebarNavigationItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
