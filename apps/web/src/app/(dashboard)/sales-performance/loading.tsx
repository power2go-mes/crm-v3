import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { PageContainer } from '@/components/shell/page-container';

export default function SalesPerformanceLoading() {
  return (
    <PageContainer>
      <LoadingSkeleton lines={6} />
    </PageContainer>
  );
}
