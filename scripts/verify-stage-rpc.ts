import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function verifyStageRPC() {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
  const line = envContent.split('\n').find((l) => l.startsWith('SUPABASE_DB_URL=') || l.startsWith('DATABASE_URL='));
  const connectionString = line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const bdoId = '1eec3500-7e1b-4264-9047-3a9260749c7d'; // Brian Officer1
  const adminId = '37236616-9978-4a5e-9aaf-b88167e311b6'; // Sarah Admin
  
  const permCheck = await client.query('SELECT public.has_effective_permission($1, $2) as has_perm', [bdoId, 'leads.manage_stages']);
  console.log('BDO has leads.manage_stages:', permCheck.rows[0].has_perm);

  const adminPermCheck = await client.query('SELECT public.has_effective_permission($1, $2) as has_perm', [adminId, 'leads.manage_stages']);
  console.log('Admin has leads.manage_stages:', adminPermCheck.rows[0].has_perm);

  // Test executing update_lead_stage under bdo context
  await client.query('BEGIN');
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [bdoId]);
  await client.query("SELECT set_config('role', 'authenticated', true)");
  try {
    await client.query("SELECT public.update_lead_stage('new', 'New Stage Name', '#ffffff', 10)");
    console.log('BDO update: UNEXPECTED SUCCESS');
  } catch(e: any) {
    console.log('BDO update caught error:', e.code, e.message);
  }
  await client.query('ROLLBACK');

  // Test executing update_lead_stage under admin context
  await client.query('BEGIN');
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [adminId]);
  await client.query("SELECT set_config('role', 'authenticated', true)");
  try {
    const res = await client.query("SELECT public.update_lead_stage('new', 'New Lead Stage', '#3b82f6', 15)");
    console.log('Admin update success:', res.rows[0]);
  } catch(e: any) {
    console.log('Admin update error:', e.code, e.message);
  }
  await client.query('ROLLBACK');

  await client.end();
}

verifyStageRPC().catch(err => {
  console.error(err);
  process.exit(1);
});
