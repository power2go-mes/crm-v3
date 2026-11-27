import React from 'react';

export function LoadingSkeleton({
  lines = 4,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 animate-pulse crm-loading-skeleton ${className}`}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-md" />
          <div className="h-3.5 w-64 bg-slate-100 rounded-md" />
        </div>
        <div className="h-8 w-24 bg-slate-200 rounded-lg" />
      </div>

      {/* Grid or list skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-8 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Table-like rows */}
      <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3 mt-4">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 py-2 border-b border-slate-50 last:border-0">
            <div className="h-4 w-12 bg-slate-200 rounded" />
            <div className="h-4 flex-1 bg-slate-100 rounded" />
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
