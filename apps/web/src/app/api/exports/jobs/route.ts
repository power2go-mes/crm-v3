import { createClient } from '@/lib/supabase/server';
import { boundedBody } from '@/lib/imports/body';
import { createLeadExportJob, listLeadExportJobs } from '@/lib/exports/jobs';
import { exportFailure, privateExportHeaders, requireSameOrigin } from '@/lib/exports/http';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return Response.json({ jobs: await listLeadExportJobs(await createClient()) }, { headers: privateExportHeaders });
  } catch (error) {
    return exportFailure(error);
  }
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: privateExportHeaders });
  }
  try {
    const body = await boundedBody(request, 8192, 'Export request is too large.');
    const result = await createLeadExportJob(await createClient(), JSON.parse(new TextDecoder().decode(body)));
    return Response.json(result, { status: 201, headers: privateExportHeaders });
  } catch (error) {
    return exportFailure(error);
  }
}
