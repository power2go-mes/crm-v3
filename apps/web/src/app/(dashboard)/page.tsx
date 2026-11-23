import { Suspense } from 'react';
import { DashboardHome } from '@/components/dashboard/dashboard-home';
export default function HomePage(){return <Suspense fallback={<p role="status">Loading Dashboard...</p>}><DashboardHome/></Suspense>;}
