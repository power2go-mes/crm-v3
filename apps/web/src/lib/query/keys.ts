/**
 * Standardized Query Key Factory for TanStack Query in FINLONEXA CRM v3.
 *
 * Ensures all cache keys are scoped to the active authenticated user ID
 * to prevent cross-user data leakage and enable targeted cache invalidation.
 */

export interface QueryFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

export const crmQueryKeys = {
  all: (userId: string) => ['crm', userId] as const,

  // Company settings (singleton)
  companySettings: (userId: string) => [...crmQueryKeys.all(userId), 'company-settings'] as const,

  // User Profile & Roles
  userProfile: (userId: string) => [...crmQueryKeys.all(userId), 'profile'] as const,
  userRoles: (userId: string) => [...crmQueryKeys.all(userId), 'roles'] as const,
  userPermissions: (userId: string) => [...crmQueryKeys.all(userId), 'permissions'] as const,

  // Entity queries
  entity: (userId: string, entityType: string) =>
    [...crmQueryKeys.all(userId), 'entities', entityType] as const,

  entityList: (userId: string, entityType: string, filters?: QueryFilterParams) =>
    [...crmQueryKeys.entity(userId, entityType), 'list', filters || {}] as const,

  entityDetail: (userId: string, entityType: string, id: string) =>
    [...crmQueryKeys.entity(userId, entityType), 'detail', id] as const,

  // Specific domain entities
  leads: (userId: string, filters?: QueryFilterParams) =>
    crmQueryKeys.entityList(userId, 'leads', filters),
  accounts: (userId: string, filters?: QueryFilterParams) =>
    crmQueryKeys.entityList(userId, 'accounts', filters),
  contacts: (userId: string, filters?: QueryFilterParams) =>
    crmQueryKeys.entityList(userId, 'contacts', filters),
  opportunities: (userId: string, filters?: QueryFilterParams) =>
    crmQueryKeys.entityList(userId, 'opportunities', filters),
  tasks: (userId: string, filters?: QueryFilterParams) =>
    crmQueryKeys.entityList(userId, 'tasks', filters),
  reports: (userId: string, filters?: QueryFilterParams) =>
    crmQueryKeys.entityList(userId, 'reports', filters),

  // Sales Hierarchy
  hierarchy: (userId: string) => [...crmQueryKeys.all(userId), 'hierarchy'] as const,
  subordinates: (userId: string) => [...crmQueryKeys.hierarchy(userId), 'subordinates'] as const,
};
