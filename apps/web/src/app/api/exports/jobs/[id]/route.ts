import { createClient } from '@/lib/supabase/server';
import { exportFailure, exportJobIdFromPath, privateExportHeaders, requireSameOrigin } from '@/lib/exports/http';
import { getLeadExportJob, processLeadExportBatch } from '@/lib/exports/jobs';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const job = await getLeadExportJob(await createClient(), exportJobIdFromPath(request));
    return Response.json({
      job: {
        id: job.id,
        status: job.status,
        processed_rows: job.processed_rows,
        part_count: job.part_count,
        created_at: job.created_at,
        completed_at: job.completed_at,
      },
    }, { headers: privateExportHeaders });
  } catch (error) {
    return exportFailure(error);
  }
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: privateExportHeaders });
  }
  try {
    const result = await processLeadExportBatch(await createClient(), exportJobIdFromPath(request));
    return Response.json(result, {
      status: result.busy ? 202 : 200,
      headers: privateExportHeaders,
    });
  } catch (error) {
    return exportFailure(error);
  }
}
