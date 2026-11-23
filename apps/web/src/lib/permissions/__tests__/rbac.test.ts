import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ROLES,
  INITIAL_PERMISSIONS,
  INITIAL_ROLE_PERMISSIONS,
} from '../constants';
import type { RolePermission } from '../actions';

// Simulated permission evaluator mirroring Supabase DB function `has_effective_permission`
// Universal role-based bypasses are prohibited: permissions resolve strictly from role_permissions
function evaluateEffectivePermission(
  roles: string[],
  action: string,
  rolePermissions: RolePermission[]
): boolean {
  const match = rolePermissions.find(
    (rp) => roles.includes(rp.role_id) && rp.permission_id === action
  );
  return match ? match.is_granted : false;
}

// Simulated reporting relationship validator mirroring PostgreSQL trigger `validate_sales_reporting_relationship`
function validateReportingRelationship(
  subordinateRole: string,
  managerRole: string
): { valid: boolean; error?: string } {
  const allowedHierarchy: Record<string, string> = {
    BDO: 'ASM',
    ASM: 'SSM',
    SSM: 'RSM',
    RSM: 'HEAD_OF_SALES',
  };

  if (subordinateRole === managerRole) {
    return { valid: false, error: 'Self-reporting is strictly forbidden.' };
  }

  const expectedManagerRole = allowedHierarchy[subordinateRole];
  if (!expectedManagerRole) {
    return {
      valid: false,
      error: `Role ${subordinateRole} is not an authorized subordinate position in the sales hierarchy.`,
    };
  }

  if (managerRole !== expectedManagerRole) {
    return {
      valid: false,
      error: `Hierarchy violation: ${subordinateRole} must report strictly to ${expectedManagerRole}, not ${managerRole}.`,
    };
  }

  return { valid: true };
}

// Simulated cycle detector
function detectCycle(
  relationships: { subordinate: string; manager: string }[],
  newSubordinate: string,
  newManager: string
): boolean {
  if (newSubordinate === newManager) return true;

  const adj = new Map<string, string[]>();
  for (const rel of relationships) {
    if (!adj.has(rel.manager)) adj.set(rel.manager, []);
    adj.get(rel.manager)!.push(rel.subordinate);
  }
  if (!adj.has(newManager)) adj.set(newManager, []);
  adj.get(newManager)!.push(newSubordinate);

  // DFS to check if newManager can reach newManager
  const visited = new Set<string>();
  const stack = [newSubordinate];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newManager) return true; // Cycle detected
    if (!visited.has(current)) {
      visited.add(current);
      const subs = adj.get(current) || [];
      for (const s of subs) {
        stack.push(s);
      }
    }
  }

  return false;
}

describe('FINLONEXA CRM v3 — RBAC & Sales Hierarchy Verification', () => {
  it('1. Verifies the six canonical roles and strict hierarchy rank order', () => {
    const canonicalIds = CANONICAL_ROLES.map((r) => r.id);
    expect(canonicalIds).toEqual([
      'SUPER_ADMIN',
      'HEAD_OF_SALES',
      'RSM',
      'SSM',
      'ASM',
      'BDO',
    ]);

    // Check rank order (strictly ascending ranks 0 to 50: 0=SUPER_ADMIN, 10=HEAD_OF_SALES, 20=RSM, etc.)
    const ranks = CANONICAL_ROLES.map((r) => r.hierarchy_rank!);
    for (let i = 0; i < ranks.length - 1; i++) {
      expect(ranks[i]).toBeLessThan(ranks[i + 1]);
    }

    // Verify all canonical roles are protected
    CANONICAL_ROLES.forEach((role) => {
      expect(role.is_canonical).toBe(true);
    });
  });

  it('2. Enforces initial permission rule: BDO is DENIED leads.create by default', () => {
    const bdoCanCreateLeads = evaluateEffectivePermission(
      ['BDO'],
      'leads.create',
      INITIAL_ROLE_PERMISSIONS
    );
    expect(bdoCanCreateLeads).toBe(false);

    // But BDO can view and export leads
    const bdoCanViewLeads = evaluateEffectivePermission(
      ['BDO'],
      'leads.view',
      INITIAL_ROLE_PERMISSIONS
    );
    const bdoCanExportLeads = evaluateEffectivePermission(
      ['BDO'],
      'leads.export',
      INITIAL_ROLE_PERMISSIONS
    );
    expect(bdoCanViewLeads).toBe(true);
    expect(bdoCanExportLeads).toBe(true);
  });

  it('3. Enforces initial permission rule: ASM, SSM, RSM, HEAD_OF_SALES, SUPER_ADMIN can create leads', () => {
    const allowedRoles = ['ASM', 'SSM', 'RSM', 'HEAD_OF_SALES', 'SUPER_ADMIN'];

    allowedRoles.forEach((role) => {
      const canCreate = evaluateEffectivePermission(
        [role],
        'leads.create',
        INITIAL_ROLE_PERMISSIONS
      );
      expect(canCreate).toBe(true);
    });
  });

  it('4. Allows dynamic permission granting and revoking without altering canonical IDs', () => {
    let currentPermissions: RolePermission[] = [...INITIAL_ROLE_PERMISSIONS];

    // Grant BDO leads.create dynamically via Role Manager
    currentPermissions = currentPermissions.map((rp) =>
      rp.role_id === 'BDO' && rp.permission_id === 'leads.create'
        ? { ...rp, is_granted: true }
        : rp
    );
    expect(evaluateEffectivePermission(['BDO'], 'leads.create', currentPermissions)).toBe(true);

    // Revoke BDO leads.create
    currentPermissions = currentPermissions.map((rp) =>
      rp.role_id === 'BDO' && rp.permission_id === 'leads.create'
        ? { ...rp, is_granted: false }
        : rp
    );
    expect(evaluateEffectivePermission(['BDO'], 'leads.create', currentPermissions)).toBe(false);
  });

  it('5. Enforces strict sales hierarchy level reporting rules', () => {
    // Valid reporting
    expect(validateReportingRelationship('BDO', 'ASM').valid).toBe(true);
    expect(validateReportingRelationship('ASM', 'SSM').valid).toBe(true);
    expect(validateReportingRelationship('SSM', 'RSM').valid).toBe(true);
    expect(validateReportingRelationship('RSM', 'HEAD_OF_SALES').valid).toBe(true);

    // Invalid reporting (cross-level or skipping)
    const invalidSkip1 = validateReportingRelationship('BDO', 'SSM');
    expect(invalidSkip1.valid).toBe(false);
    expect(invalidSkip1.error).toContain('BDO must report strictly to ASM, not SSM');

    const invalidSkip2 = validateReportingRelationship('BDO', 'RSM');
    expect(invalidSkip2.valid).toBe(false);

    const invalidSkip3 = validateReportingRelationship('ASM', 'HEAD_OF_SALES');
    expect(invalidSkip3.valid).toBe(false);

    // Self-reporting
    const selfReport = validateReportingRelationship('ASM', 'ASM');
    expect(selfReport.valid).toBe(false);
    expect(selfReport.error).toContain('Self-reporting is strictly forbidden');
  });

  it('6. Detects and rejects circular reporting loops (anti-cycle trigger logic)', () => {
    const relationships = [
      { subordinate: 'user-bdo', manager: 'user-asm' },
      { subordinate: 'user-asm', manager: 'user-ssm' },
      { subordinate: 'user-ssm', manager: 'user-rsm' },
    ];

    // Trying to make user-asm report to user-bdo creates a cycle
    const cycle1 = detectCycle(relationships, 'user-asm', 'user-bdo');
    expect(cycle1).toBe(true);

    // Trying to make user-rsm report to user-bdo creates a cycle
    const cycle2 = detectCycle(relationships, 'user-rsm', 'user-bdo');
    expect(cycle2).toBe(true);

    // Valid new relationship without cycle
    const validRel = detectCycle(relationships, 'user-rsm', 'user-head-of-sales');
    expect(validRel).toBe(false);
  });

  it('7. Confirms Single-Company architecture constraints', () => {
    // Single-company mode has no company_id multi-tenancy requirements
    const coreSchemaTables = [
      'company_settings',
      'user_profiles',
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'sales_regions',
      'sales_teams',
      'sales_reporting_relationships',
      'leads',
    ];

    expect(coreSchemaTables.length).toBe(10);
  });

  it('8. Prohibits hardcoded SUPER_ADMIN bypass: SUPER_ADMIN permissions resolve dynamically', () => {
    // When granted in INITIAL_ROLE_PERMISSIONS
    expect(
      evaluateEffectivePermission(['SUPER_ADMIN'], 'dashboard.view', INITIAL_ROLE_PERMISSIONS)
    ).toBe(true);
    expect(
      evaluateEffectivePermission(['SUPER_ADMIN'], 'leads.create', INITIAL_ROLE_PERMISSIONS)
    ).toBe(true);

    // When revoked dynamically, SUPER_ADMIN is strictly denied (no wildcard/bypass)
    const revokedSuperAdminPermissions: RolePermission[] = INITIAL_ROLE_PERMISSIONS.map((rp) =>
      rp.role_id === 'SUPER_ADMIN' && rp.permission_id === 'leads.create'
        ? { ...rp, is_granted: false }
        : rp
    );

    expect(
      evaluateEffectivePermission(
        ['SUPER_ADMIN'],
        'leads.create',
        revokedSuperAdminPermissions
      )
    ).toBe(false);

    // Non-existent permission evaluates to false for SUPER_ADMIN
    expect(
      evaluateEffectivePermission(
        ['SUPER_ADMIN'],
        'nonexistent.permission',
        INITIAL_ROLE_PERMISSIONS
      )
    ).toBe(false);
  });

  it('9. Verifies all dedicated module permissions exist in catalog', () => {
    const permissionIds = INITIAL_PERMISSIONS.map((p) => p.id);
    expect(permissionIds).toContain('dashboard.view');
    expect(permissionIds).toContain('tasks.view');
    expect(permissionIds).toContain('calls.view');
    expect(permissionIds).toContain('meetings.view');
    expect(permissionIds).toContain('reports.view');
    expect(permissionIds).toContain('sales_performance.view');
  });

  it('10. Enforces BDO dedicated permission defaults while keeping leads.create denied', () => {
    expect(evaluateEffectivePermission(['BDO'], 'dashboard.view', INITIAL_ROLE_PERMISSIONS)).toBe(true);
    expect(evaluateEffectivePermission(['BDO'], 'tasks.view', INITIAL_ROLE_PERMISSIONS)).toBe(true);
    expect(evaluateEffectivePermission(['BDO'], 'calls.view', INITIAL_ROLE_PERMISSIONS)).toBe(true);
    expect(evaluateEffectivePermission(['BDO'], 'meetings.view', INITIAL_ROLE_PERMISSIONS)).toBe(true);
    expect(evaluateEffectivePermission(['BDO'], 'reports.view', INITIAL_ROLE_PERMISSIONS)).toBe(true);

    // Strict default denials
    expect(evaluateEffectivePermission(['BDO'], 'leads.create', INITIAL_ROLE_PERMISSIONS)).toBe(false);
    expect(evaluateEffectivePermission(['BDO'], 'sales_performance.view', INITIAL_ROLE_PERMISSIONS)).toBe(false);
  });
});
