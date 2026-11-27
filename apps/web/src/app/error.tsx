'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled CRM error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-6">
          An error occurred while loading this page. Security and session policies remain intact.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#4361ee] rounded-lg hover:bg-[#4361ee] transition"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
