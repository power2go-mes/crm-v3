import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { browserLabel, formatLoginTime, loadLoginHistory, sessionIsActive } from '../login-history';
describe('Login history source behavior and private projection',()=>{
 it('uses source browser-major and initial UA segment presentation',()=>{
  expect(browserLabel('Mozilla/5.0 (Synthetic OS) Chrome/139.0.1')).toBe('Chrome 139 — Mozilla/5.0 (Synthetic OS)');
  expect(browserLabel('Mozilla/5.0 (Windows) Chrome/139.0 Edg/139.0')).toBe('Edge 139 — Mozilla/5.0 (Windows)');
  expect(browserLabel(null)).toBe('Not available');
 });
 it('matches the source date format and derives active state from real session signals',()=>{
  expect(formatLoginTime('2026-11-18T01:05:00Z','UTC')).toBe('18 nov 2026, 01:05 a.m.');
  expect(sessionIsActive({ended_at:null,expires_at:null})).toBe(true);
  expect(sessionIsActive({ended_at:'2026-11-18T01:05:00Z',expires_at:null})).toBe(false);
  expect(sessionIsActive({ended_at:null,expires_at:'2020-01-01T00:00:00Z'})).toBe(false);
 });
 it('never selects internal session identifiers and bounds/filter reads on the database',async()=>{
  const range=vi.fn().mockResolvedValue({data:[],count:25,error:null});const order=vi.fn();order.mockReturnValue({order,range});const eq=vi.fn().mockReturnValue({order});const select=vi.fn().mockReturnValue({eq,order});
  const client={from:()=>({select})} as unknown as SupabaseClient<Database>;
  await loadLoginHistory(client,2,'c0de0000-0000-4000-8000-000000001001');
  expect(select.mock.calls[0][0]).not.toContain('auth_session_id');expect(select.mock.calls[0][0]).not.toContain('*');expect(range).toHaveBeenCalledWith(20,39);expect(eq).toHaveBeenCalledWith('user_id','c0de0000-0000-4000-8000-000000001001');
 });
 it('rejects invalid page/filter parameters before contacting the database',async()=>{
  const from=vi.fn();const client={from} as unknown as SupabaseClient<Database>;
  await expect(loadLoginHistory(client,0)).rejects.toThrow();await expect(loadLoginHistory(client,1,'not-an-id')).rejects.toThrow();expect(from).not.toHaveBeenCalled();
 });
});
