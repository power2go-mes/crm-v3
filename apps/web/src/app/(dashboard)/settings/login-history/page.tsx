import { LoginHistory } from '@/components/settings/login-history';
export default async function LoginHistoryPage({ searchParams }: { searchParams: Promise<{ user?: string | string[]; pk?: string | string[] }> }) {
  const params = await searchParams;
  const selected = params.user ?? params.pk;
  const userId = Array.isArray(selected) ? selected[selected.length - 1] : selected;
  return <LoginHistory key={userId ?? 'all'} team userId={userId} />;
}
