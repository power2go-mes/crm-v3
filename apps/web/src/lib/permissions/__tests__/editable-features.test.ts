import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn(), permission: true, from: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { toggleRolePermission, createCustomRole, deleteCustomRole, assignUserRole } from '../actions';
beforeEach(() => {
  vi.clearAllMocks(); mocks.permission = true;
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'fixture' } }, error: null }); mocks.upsert.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'user_profiles') return { select: () => ({ eq: () => ({ single: async () => ({ data: { is_active: true } }) }) }) };
    if (table === 'user_roles') return { select: () => ({ eq: async () => ({ data: [{ role_id: 'TEST' }] }) }) };
    return { upsert: mocks.upsert, select: () => ({ in: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: mocks.permission ? [{ is_granted: true }] : [] }) }) }) }) }) };
  });
});
describe('Editable canonical feature permissions', () => {
  it('allows an authorized actor to revoke SUPER_ADMIN roles.manage', async () => {
    expect(await toggleRolePermission('SUPER_ADMIN', 'roles.manage', false)).toEqual({ success: true });
    expect(mocks.upsert).toHaveBeenCalledWith({ role_id: 'SUPER_ADMIN', permission_id: 'roles.manage', is_granted: false });
  });
  it('denies missing administrative feature before any write', async () => {
    mocks.permission = false;
    expect((await toggleRolePermission('SUPER_ADMIN', 'roles.manage', false)).success).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('fails closed on unauthenticated requests for every administrative mutation', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const results = await Promise.all([toggleRolePermission('SUPER_ADMIN', 'roles.manage', false), createCustomRole({ id: 'TEST', name: 'Test' }), deleteCustomRole('TEST'), assignUserRole('fixture', 'TEST')]);
    expect(results.every(result => !result.success)).toBe(true); expect(mocks.from).not.toHaveBeenCalled();
  });
});
