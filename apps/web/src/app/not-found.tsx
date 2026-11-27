import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Page Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">
          The requested CRM resource does not exist or you do not have permission to access it.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#4361ee] rounded-lg hover:bg-[#4361ee] transition"
        >
          <Home className="h-4 w-4" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
