import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), single: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: m.getUser }, rpc: m.rpc, from: () => ({ select: () => ({ eq: () => ({ single: m.single }) }) }) }) }));
import { GET, POST } from '@/app/api/imports/route';
const id = 'c0de0000-0000-4000-8000-000000000701';
beforeEach(() => { vi.clearAllMocks(); m.getUser.mockResolvedValue({ data: { user: { id } }, error: null }); m.rpc.mockImplementation(async (name: string) => ({ data: name === 'has_effective_permission' ? true : id, error: null })); m.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } }); });
describe('Actual import HTTP handlers', () => {
  it('accepts a real multipart CSV through the server parser and preparation RPC', async () => {
    const form = new FormData(); form.set('name', 'CSV fixture'); form.set('file', new File(['First Name,Last Name\nA,B'], 'fixture.csv', { type: 'text/csv' }));
    const response = await POST(new Request('http://localhost:3000/api/imports', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: form }));
    expect(response.status).toBe(200); expect((await response.json()).id).toBe(id);
    expect(m.rpc.mock.calls.some(([name]) => name === 'create_lead_import')).toBe(true);
  });
  it('rejects cross-origin writes and unauthenticated imports before mutation', async () => {
    expect((await POST(new Request('http://localhost:3000/api/imports', { method: 'POST', headers: { Origin: 'http://foreign.example' }, body: '{}' }))).status).toBe(403);
    m.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(new Request('http://localhost:3000/api/imports', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('denies guessed/foreign import downloads and does not produce blank error files', async () => {
    expect((await GET(new Request(`http://localhost:3000/api/imports?id=${id}`))).status).toBe(404);
    m.single.mockResolvedValue({ data: { filename: 'fixture.csv', source_csv: 'a\nb', result: null }, error: null });
    expect((await GET(new Request(`http://localhost:3000/api/imports?id=${id}&errors=1`))).status).toBe(404);
  });
  it('generates actual error CSV and preserves original content with a safe filename', async () => {
    m.single.mockResolvedValue({ data: { filename: 'own file.csv', source_csv: 'a\nb', result: { errors: [{ row: 2, message: 'Invalid value.' }] } }, error: null });
    const errors = await GET(new Request(`http://localhost:3000/api/imports?id=${id}&errors=1`));
    expect(await errors.text()).toContain('2,"Invalid value."');
    const original = await GET(new Request(`http://localhost:3000/api/imports?id=${id}`));
    expect(await original.text()).toBe('a\nb'); expect(original.headers.get('content-disposition')).toContain('own%20file.csv');
  });
});
