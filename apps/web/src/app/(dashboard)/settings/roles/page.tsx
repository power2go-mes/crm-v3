import { getRolesAndPermissionsData } from '@/lib/permissions/actions';
import {
  CANONICAL_ROLES,
  INITIAL_PERMISSIONS,
  INITIAL_ROLE_PERMISSIONS,
} from '@/lib/permissions/constants';
import { RoleMatrixClient } from './role-matrix-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Roles & Permissions — FINLONEXA CRM v3',
  description: 'Dynamic Role Manager for Canonical & Custom Company Roles',
};

import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';

export default async function RolesPage() {
  let roles = CANONICAL_ROLES;
  let permissions = INITIAL_PERMISSIONS;
  let rolePermissions = INITIAL_ROLE_PERMISSIONS;

  try {
    const data = await getRolesAndPermissionsData();
    if (data.roles && data.roles.length > 0) {
      roles = data.roles;
    }
    if (data.permissions && data.permissions.length > 0) {
      permissions = data.permissions;
    }
    if (data.rolePermissions && data.rolePermissions.length > 0) {
      rolePermissions = data.rolePermissions;
    }
  } catch (err) {
    // If runtime DB connection is offline during initial static generation, use baseline constants
    console.warn('Falling back to baseline permissions constants:', err);
  }

  return (
    <PageContainer>
      <PermissionGate action="roles.view" showAccessDenied>
        <RoleMatrixClient
          initialRoles={roles}
          initialPermissions={permissions}
          initialRolePermissions={rolePermissions}
        />
      </PermissionGate>
    </PageContainer>
  );
}
