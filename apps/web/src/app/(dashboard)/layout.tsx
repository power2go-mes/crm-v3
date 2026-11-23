import React from 'react';
import { AuthenticatedShell } from '@/components/shell/authenticated-shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
