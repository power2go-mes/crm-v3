import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { PageContainer } from '@/components/shell/page-container';

export default function AccountsLoading() {
  return (
    <PageContainer>
      <LoadingSkeleton lines={5} />
    </PageContainer>
  );
}
