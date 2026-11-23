import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ catalog: vi.fn(), run: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: m.create }));
vi.mock('@/lib/exports/service', () => ({ centralExportCatalog: m.catalog, runCentralExport: m.run }));
import { GET, POST } from '@/app/api/exports/route';
beforeEach(() => { vi.clearAllMocks(); m.create.mockResolvedValue({}); m.catalog.mockResolvedValue([{ module: 'leads', label: 'Leads', columns: [] }]); m.run.mockResolvedValue({ filename: 'export_csv.zip', contentType: 'application/zip', bytes: Buffer.from('actual file bytes'), rows: 3 }); });
describe('Central export HTTP contract', () => {
  it('loads fields only for explicit supported modules and does not cache metadata publicly', async () => {
    const response = await GET(new Request('http://localhost:3000/api/exports?module=contacts'));
    expect(response.status).toBe(200); expect(m.catalog).toHaveBeenCalledWith({}, ['contacts']); expect(response.headers.get('cache-control')).toContain('no-store');
    expect((await GET(new Request('http://localhost:3000/api/exports?module=user_profiles'))).status).toBe(400);
  });
  it('rejects foreign/missing origins before processing a download request', async () => {
    expect((await POST(new Request('http://localhost:3000/api/exports', { method: 'POST', body: '{}' }))).status).toBe(403);
    expect((await POST(new Request('http://localhost:3000/api/exports', { method: 'POST', headers: { Origin: 'http://foreign.example' }, body: '{}' }))).status).toBe(403);
    expect(m.run).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it('returns actual file bytes with row count and safe private download headers', async () => {
    const response = await POST(new Request('http://localhost:3000/api/exports', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: '{}' }));
    expect(await response.text()).toBe('actual file bytes'); expect(response.headers.get('x-export-rows')).toBe('3'); expect(response.headers.get('content-type')).toBe('application/zip'); expect(response.headers.get('content-disposition')).toContain('export_csv.zip');
  });
  it('fails closed on auth/permission errors without attaching a fake file', async () => {
    m.catalog.mockRejectedValue(new Error('Authentication required.'));
    expect((await GET(new Request('http://localhost:3000/api/exports'))).status).toBe(401);
    m.run.mockRejectedValue(new Error('Module export permission denied.'));
    const response = await POST(new Request('http://localhost:3000/api/exports', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: '{}' }));
    expect(response.status).toBe(403); expect(response.headers.get('content-disposition')).toBeNull();
  });
});
