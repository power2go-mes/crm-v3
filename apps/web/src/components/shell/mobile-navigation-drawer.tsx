'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ApplicationSidebar } from './application-sidebar';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigationDrawer({
  isOpen,
  onClose,
}: MobileNavigationDrawerProps) {
  // Prevent background scroll when open & handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 left-0 flex max-w-full z-50">
        <div className="relative w-72 bg-white flex flex-col shadow-2xl">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="absolute top-4 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>

          <ApplicationSidebar
            isCollapsed={false}
            onToggleCollapse={onClose}
            onNavigate={onClose}
            className="w-full border-r-0 h-full"
          />
        </div>
      </div>
    </div>
  );
}
