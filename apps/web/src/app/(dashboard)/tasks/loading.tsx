import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { PageContainer } from '@/components/shell/page-container';

export default function TasksLoading() {
  return (
    <PageContainer>
      <LoadingSkeleton lines={4} />
    </PageContainer>
  );
}
