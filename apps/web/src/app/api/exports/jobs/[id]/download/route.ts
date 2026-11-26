import { createClient } from '@/lib/supabase/server';
import { exportFailure, exportJobIdFromPath, privateExportHeaders } from '@/lib/exports/http';
import { getLeadExportJob, leadExportPartPath } from '@/lib/exports/jobs';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const id = exportJobIdFromPath(request, 1);
    const client = await createClient();
    const job = await getLeadExportJob(client, id);
    if (job.status !== 'completed' || !job.storage_path || job.part_count < 1 || job.part_count > 401) {
      return Response.json({ error: 'Export file is not ready.' }, { status: 409, headers: privateExportHeaders });
    }

    let part = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (cancelled) return;
        if (part >= job.part_count) {
          controller.close();
          return;
        }
        try {
          const path = leadExportPartPath(job.user_id, job.id, part++);
          const { data, error } = await client.storage.from('crm-export-jobs').download(path);
          if (cancelled) return;
          if (error || !data) {
            controller.error(new Error('Export file could not be loaded.'));
            return;
          }
          controller.enqueue(new Uint8Array(await data.arrayBuffer()));
        } catch {
          if (!cancelled) controller.error(new Error('Export file could not be loaded.'));
        }
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(body, {
      headers: {
        ...privateExportHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-export-${job.id}.csv"`,
        'X-Export-Rows': String(job.processed_rows),
        'Content-Length': String(job.output_bytes),
      },
    });
  } catch (error) {
    return exportFailure(error);
  }
}
