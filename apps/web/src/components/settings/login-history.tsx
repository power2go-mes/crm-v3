'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { DataGrid, type ColumnDef } from '@/components/ui/data-grid/data-grid';
import { browserLabel, formatLoginTime, loadLoginHistory, sessionIsActive } from '@/lib/settings/login-history';

type HistoryRow = Awaited<ReturnType<typeof loadLoginHistory>>['rows'][number];
export function LoginHistory({ team = false, userId }: { team?: boolean; userId?: string }) {
  const { user, profile, permissions, hasPermission, isLoading } = useAuth();
  const [page, setPage] = useState(1);
  const allowed = team ? hasPermission('login_history.view_team') && hasPermission('users.view') : hasPermission('login_history.view_own') || hasPermission('login_history.view_team');
  const history = useQuery({
    queryKey: ['crm', user?.id, 'login-history', [...permissions].sort().join('|'), team, userId, page],
    enabled: !isLoading && !!user && !!profile?.is_active && allowed,
    queryFn: () => loadLoginHistory(createClient(), page, team ? userId : user!.id),
  });
  const columns: ColumnDef<HistoryRow>[] = [
    { id: 'browser', header: 'Browser', width: '250px', cell: row => <span title={row.user_agent ?? undefined}>{browserLabel(row.user_agent)}</span> },
    { id: 'login_at', header: 'Login Time', width: '125px', cell: row => formatLoginTime(row.login_at) },
    { id: 'active', header: 'Is Active', width: '80px', cell: row => <span role="img" aria-label={sessionIsActive(row) ? 'Active' : 'Inactive'}>{sessionIsActive(row) ? <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" /> : <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />}</span> },
    { id: 'ip', header: 'IP', width: '100px', accessorKey: 'ip' },
    { id: 'status', header: 'Status', width: '100px', cell: row => sessionIsActive(row) ? 'Login' : 'Logout' },
  ];
  return <PageContainer>
    <PageHeader title={team ? 'Login History' : 'My Login History'} subtitle={team ? 'Review sign-in activity for users across your organization.' : 'Review the sign-in activity on your account.'} />
    {isLoading ? <p role="status">Loading access…</p> : !allowed || !profile?.is_active ? <p role="alert">You do not have permission to view this login history.</p> : history.error ? <p role="alert">{history.error.message} <button onClick={() => void history.refetch()}>Retry</button></p> : <>
      <DataGrid columns={columns} data={history.data?.rows ?? []} keyExtractor={row => row.id} isLoading={history.isLoading} emptyState={<p>No login history available for this user.</p>} />
      <nav aria-label="Login history pagination" className="mt-4 flex gap-4 text-sm"><button disabled={page === 1 || history.isLoading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {history.data?.count ?? 0} records</span><button disabled={history.isLoading || page * 20 >= (history.data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</button></nav>
    </>}
  </PageContainer>;
}
