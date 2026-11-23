import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { departmentInput, saveDepartment, setDepartmentDeleted } from '../departments';

describe('Department persistence contract', () => {
  it('retains optional description and source name bound', () => {
    expect(departmentInput.parse({ id: null, department_name: ' Sales ', description: null }).department_name).toBe('Sales');
    expect(departmentInput.safeParse({ id: null, department_name: 'x'.repeat(51), description: '' }).success).toBe(false);
    expect(departmentInput.safeParse({ id: null, department_name: ' ', description: '' }).success).toBe(false);
  });
  it('sends no forged actor and uses the trusted RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'saved', error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await expect(saveDepartment(client, { id: null, department_name: 'Sales', description: null })).resolves.toBe('saved');
    expect(rpc).toHaveBeenCalledWith('save_department', { p_id: null, p_name: 'Sales', p_description: null });
    await expect(saveDepartment(client, { id: null, department_name: 'Sales', description: null, created_by_id: 'forged' } as never)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('surfaces dependency denial instead of reporting a successful delete', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: '23503', message: 'Department is referenced by users' } });
    await expect(setDepartmentDeleted({ rpc } as unknown as SupabaseClient<Database>, 'c0de0000-0000-4000-8000-000000000501', true)).rejects.toThrow('referenced');
  });
  it('preserves restore conflicts and database authorization errors', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: { code: '23505' } }).mockResolvedValueOnce({ error: { code: '42501', message: 'Permission denied' } });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await expect(setDepartmentDeleted(client, 'c0de0000-0000-4000-8000-000000000501', false)).rejects.toThrow('before restoring');
    await expect(saveDepartment(client, { id: null, department_name: 'Sales', description: '' })).rejects.toThrow('Permission denied');
  });
});
