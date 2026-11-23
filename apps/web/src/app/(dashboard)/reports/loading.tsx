import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { PageContainer } from '@/components/shell/page-container';

export default function ReportsLoading() {
  return (
    <PageContainer>
      <LoadingSkeleton lines={6} />
    </PageContainer>
  );
}
