'use client';

import React from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { ShieldAlert } from 'lucide-react';

interface PermissionGateProps {
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAccessDenied?: boolean;
}

export function PermissionGate({
  action,
  children,
  fallback = null,
  showAccessDenied = false,
}: PermissionGateProps) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    if (showAccessDenied) {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#4f46e5] border-t-transparent" />
        </div>
      );
    }
    return null;
  }

  const allowed = hasPermission(action);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showAccessDenied) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-amber-50/50 border border-amber-200 rounded-xl my-6 max-w-lg mx-auto">
        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-100 text-amber-700 mb-3">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-bold text-amber-900 mb-1">Access Restricted</h4>
        <p className="text-xs text-amber-700 leading-relaxed">
          Your active role does not possess the <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px]">{action}</code> permission required to view this content.
        </p>
      </div>
    );
  }

  return null;
}
