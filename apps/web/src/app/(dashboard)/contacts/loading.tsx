import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { PageContainer } from '@/components/shell/page-container';

export default function ContactsLoading() {
  return (
    <PageContainer>
      <LoadingSkeleton lines={5} />
    </PageContainer>
  );
}
