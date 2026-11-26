import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  createJob: vi.fn(),
  listJobs: vi.fn(),
  getJob: vi.fn(),
  processBatch: vi.fn(),
  partPath: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }));
vi.mock('@/lib/exports/jobs', () => ({
  createLeadExportJob: mocks.createJob,
  listLeadExportJobs: mocks.listJobs,
  getLeadExportJob: mocks.getJob,
  processLeadExportBatch: mocks.processBatch,
  leadExportPartPath: mocks.partPath,
}));

import { GET as list, POST as create } from '@/app/api/exports/jobs/route';
import { GET as get, POST as process } from '@/app/api/exports/jobs/[id]/route';
import { GET as download } from '@/app/api/exports/jobs/[id]/download/route';

const jobId = 'c2fbf79b-201b-4aa3-926e-2e6ef6826079';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({});
  mocks.createJob.mockResolvedValue({ id: jobId });
  mocks.listJobs.mockResolvedValue([]);
  mocks.getJob.mockResolvedValue({ id: jobId, status: 'queued' });
  mocks.processBatch.mockResolvedValue({ status: 'queued', processedRows: 250, totalRows: null, busy: false });
});

describe('resumable export job HTTP contract', () => {
  it('creates only same-origin jobs and lists private recent jobs', async () => {
    const denied = await create(new Request('http://localhost:3000/api/exports/jobs', { method: 'POST', body: '{}' }));
    expect(denied.status).toBe(403);
    expect(mocks.createJob).not.toHaveBeenCalled();

    const response = await create(new Request('http://localhost:3000/api/exports/jobs', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
      body: JSON.stringify({ module: 'leads', columns: ['email'] }),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: jobId });
    expect((await list()).headers.get('cache-control')).toContain('no-store');
    expect(mocks.listJobs).toHaveBeenCalledWith({});
  });

  it('returns job status and marks an occupied worker as retryable', async () => {
    const status = await get(new Request(`http://localhost:3000/api/exports/jobs/${jobId}`));
    expect(status.status).toBe(200);
    expect((await status.json()).job.id).toBe(jobId);

    mocks.processBatch.mockResolvedValue({ status: 'processing', processedRows: 250, totalRows: null, busy: true });
    const response = await process(new Request(`http://localhost:3000/api/exports/jobs/${jobId}`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    }));
    expect(response.status).toBe(202);
    expect((await response.json()).busy).toBe(true);
  });

  it('rejects malformed job identifiers before accessing data', async () => {
    const response = await get(new Request('http://localhost:3000/api/exports/jobs/not-a-uuid'));
    expect(response.status).toBe(400);
    expect(mocks.getJob).not.toHaveBeenCalled();
  });

  it('streams a completed private CSV and rejects a job that is not ready', async () => {
    const storage = { from: vi.fn(() => ({ download: vi.fn().mockResolvedValue({ data: new Blob(['"Name"\r\n"Ada"\r\n']), error: null }) })) };
    mocks.create.mockResolvedValue({ storage });
    mocks.getJob.mockResolvedValue({
      id: jobId, user_id: '98bd2a6e-2d46-484a-90b8-e6aa78d97e6c', status: 'completed',
      part_count: 1, output_bytes: 15, processed_rows: 1, storage_path: 'private/path',
    });
    mocks.partPath.mockReturnValue('private/part.csv');
    const response = await download(new Request(`http://localhost:3000/api/exports/jobs/${jobId}/download`));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('15');
    expect(await response.text()).toContain('"Ada"');
    expect(storage.from).toHaveBeenCalledWith('crm-export-jobs');

    mocks.getJob.mockResolvedValue({ id: jobId, status: 'queued' });
    const pending = await download(new Request(`http://localhost:3000/api/exports/jobs/${jobId}/download`));
    expect(pending.status).toBe(409);
  });
});
