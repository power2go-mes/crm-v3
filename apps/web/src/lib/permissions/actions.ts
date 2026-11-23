'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Database } from '@finlonexa/database';

export type Role = Database['public']['Tables']['roles']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];
export type RolePermission = Database['public']['Tables']['role_permissions']['Row'];
function actionError(error: unknown) { return error instanceof Error ? error.message : 'Administrative action failed.'; }

/**
 * Server-side authorization guard ensuring only authenticated users
 * with an active identity and explicit roles.manage permission.
 */
async function assertAuthorizedAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication Required: No valid session found.');
  }

  // Check user active status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    throw new Error('Access Denied: Inactive employee account.');
  }

  // Check role assignments
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id);

  const roleIds = userRoles ? userRoles.map((r) => r.role_id) : [];

  // Check explicit permission (no role-based universal bypasses; relies on effective granted permissions)
  const { data: perm } = await supabase
    .from('role_permissions')
    .select('is_granted')
    .in('role_id', roleIds)
    .eq('permission_id', 'roles.manage')
    .eq('is_granted', true)
    .limit(1);

  if (!perm || perm.length === 0) {
    throw new Error('Access Denied: Missing "roles.manage" administrative permission.');
  }

  return user;
}

export async function getRolesAndPermissionsData() {
  const supabase = await createClient();

  // 1. Fetch roles
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .order('hierarchy_rank', { ascending: true, nullsFirst: false });

  if (rolesError) {
    throw new Error(`Failed to fetch roles: ${rolesError.message}`);
  }

  // 2. Fetch all permissions catalog
  const { data: permissions, error: permsError } = await supabase
    .from('permissions')
    .select('*')
    .order('module', { ascending: true })
    .order('action', { ascending: true });

  if (permsError) {
    throw new Error(`Failed to fetch permissions: ${permsError.message}`);
  }

  // 3. Fetch role permission mappings
  const { data: rolePermissions, error: rpError } = await supabase
    .from('role_permissions')
    .select('*');

  if (rpError) {
    throw new Error(`Failed to fetch role permissions: ${rpError.message}`);
  }

  return {
    roles: roles || [],
    permissions: permissions || [],
    rolePermissions: rolePermissions || [],
  };
}

export async function toggleRolePermission(
  roleId: string,
  permissionId: string,
  granted: boolean
) {
  try {
    const supabase = await createClient();

    await assertAuthorizedAdmin(supabase);
    if (typeof roleId !== 'string' || !roleId || typeof permissionId !== 'string' || !permissionId || typeof granted !== 'boolean') {
      return { success: false, error: 'Invalid permission update.' };
    }

    const { error } = await supabase.from('role_permissions').upsert({
      role_id: roleId,
      permission_id: permissionId,
      is_granted: granted,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/roles');
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err) };
  }
}

export async function createCustomRole(formData: {
  id: string;
  name: string;
  description?: string;
  hierarchyRank?: number;
}) {
  try {
    const supabase = await createClient();

    await assertAuthorizedAdmin(supabase);

    // Sanitize role ID (uppercase, underscores only)
    const roleId = formData.id.trim().toUpperCase().replace(/\s+/g, '_');

    // Prevent masquerading as canonical roles
    const canonicalRoles = ['SUPER_ADMIN', 'HEAD_OF_SALES', 'RSM', 'SSM', 'ASM', 'BDO'];
    if (canonicalRoles.includes(roleId)) {
      return { success: false, error: 'Cannot create a custom role with a canonical identifier.' };
    }

    const { error } = await supabase.from('roles').insert({
      id: roleId,
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      is_canonical: false,
      hierarchy_rank: formData.hierarchyRank || 100,
      is_active: true,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/roles');
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err) };
  }
}

export async function deleteCustomRole(roleId: string) {
  try {
    const supabase = await createClient();

    await assertAuthorizedAdmin(supabase);

    // Check if role is canonical (cannot delete canonical)
    const { data: role } = await supabase
      .from('roles')
      .select('is_canonical')
      .eq('id', roleId)
      .single();

    if (role?.is_canonical) {
      return { success: false, error: 'Canonical roles are protected and cannot be deleted.' };
    }

    const { error } = await supabase.from('roles').delete().eq('id', roleId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/roles');
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err) };
  }
}

export async function assignUserRole(userId: string, roleId: string) {
  try {
    const supabase = await createClient();

    await assertAuthorizedAdmin(supabase);

    const { error } = await supabase.from('user_roles').upsert({
      user_id: userId,
      role_id: roleId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/roles');
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err) };
  }
}
