'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Failed to load content',
  message = 'An unexpected error occurred while communicating with the server. Your session and permissions remain intact.',
  retry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`p-6 sm:p-8 rounded-xl bg-red-50/50 border border-red-200 text-center max-w-lg mx-auto my-6 ${className}`}>
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-red-900 mb-1">{title}</h3>
      <p className="text-xs text-red-700/80 mb-5 leading-relaxed">{message}</p>
      {retry && (
        <button
          onClick={retry}
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Request</span>
        </button>
      )}
    </div>
  );
}
