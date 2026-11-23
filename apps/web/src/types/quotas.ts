export interface SalesQuota {
  id: string;
  user_id: string;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  target_amount: number;
  currency: string;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department?: string | null;
    designation?: string | null;
  } | null;
}

export interface SalesPerformanceRep {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  hierarchyRank: number;
  department: string | null;
  designation: string | null;
  managerName: string | null;
  wonRevenue: number;
  wonDealsCount: number;
  openPipelineValue: number;
  openDealsCount: number;
  quota: number;
  quotaId?: string | null;
  attainmentPercent: number;
}

export interface SalesPerformanceLeaderboard {
  period_start: string;
  period_end: string;
  period_type: string;
  totalTeamWon: number;
  totalTeamQuota: number;
  overallAttainment: number;
  totalOpenPipeline: number;
  activeRepsCount: number;
  reps: SalesPerformanceRep[];
  topPerformer: SalesPerformanceRep | null;
}
