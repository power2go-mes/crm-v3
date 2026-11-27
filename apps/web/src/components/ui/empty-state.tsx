import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  phaseBadge?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  phaseBadge = 'Phase 3 Business Module',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 shadow-xs max-w-2xl mx-auto my-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 mb-4">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 mb-2">
        {phaseBadge}
      </div>

      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {action && (
        <div>
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#4361ee] hover:bg-[#3a5bf0] rounded-lg shadow-xs transition"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              type="button"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#4361ee] hover:bg-[#3a5bf0] rounded-lg shadow-xs transition"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
