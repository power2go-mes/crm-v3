import React from 'react';
import { Breadcrumbs } from './breadcrumbs';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  breadcrumbs = true,
}: PageHeaderProps) {
  return (
    <div className="mb-6 space-y-2">
      {breadcrumbs && <Breadcrumbs className="mb-3" />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="break-words text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
