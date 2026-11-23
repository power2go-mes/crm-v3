import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const status = passed ? '[PASS]' : '[FAIL]';
  console.log(`${status} ${name}: ${details}`);
}

async function main() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Authenticated Calls Workflow Verification');
  console.log('====================================================');

  const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
  const adminEmail = 'test.superadmin@finlonexa.test';
  const adminPassword = creds[adminEmail];

  const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
  const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

  // 1. Authenticate as SuperAdmin
  const adminClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authRes = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  const loggedIn = !authRes.error && !!authRes.data.session?.access_token;
  record('1. SuperAdmin Authentication', loggedIn, loggedIn ? `Authenticated as ${adminEmail}` : `Failed: ${authRes.error?.message}`);
  if (!loggedIn) process.exit(1);

  const adminToken = authRes.data.session!.access_token;
  const adminUser = authRes.data.user!;

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${adminToken}` } },
  });

  // 2. Log Call
  const testSubject = `Automated E2E Outbound Discovery Call ${Date.now()}`;
  const createRes = await client
    .from('activities')
    .insert({
      activity_type: 'log_call',
      subject: testSubject,
      call_type: 'outbound',
      call_duration_minutes: 15,
      description: 'Discussed CRM v3 integration requirements and timeline.',
      status: 'completed',
      start_time: new Date().toISOString(),
      assigned_to_id: adminUser.id,
      created_by_id: adminUser.id,
      related_to_type: 'opportunity',
    })
    .select()
    .single();

  const created = !createRes.error && !!createRes.data?.id;
  record('2. Call Log Creation with Direction & Duration', created, created ? `Created call record id: ${createRes.data.id}` : `Failed: ${createRes.error?.message}`);
  if (!created) process.exit(1);

  const callId = createRes.data.id;

  // 3. Query Call Detail with Joined Caller
  const detailRes = await client
    .from('activities')
    .select(`
      *,
      assigned_to:user_profiles!assigned_to_id(id, first_name, last_name, email),
      created_by:user_profiles!created_by_id(id, first_name, last_name, email)
    `)
    .eq('id', callId)
    .single();

  const detailSuccess = !detailRes.error && detailRes.data?.subject === testSubject && detailRes.data?.call_type === 'outbound';
  record('3. Call Detail Query with Caller Profile', detailSuccess, detailSuccess ? `Retrieved call with caller: ${detailRes.data.assigned_to.email}` : `Failed: ${detailRes.error?.message}`);

  // 4. Update Call
  const updateRes = await client
    .from('activities')
    .update({ description: 'Follow-up scheduled for next week.' })
    .eq('id', callId)
    .select()
    .single();

  const updateSuccess = !updateRes.error && updateRes.data?.description === 'Follow-up scheduled for next week.';
  record('4. Call Record Update', updateSuccess, updateSuccess ? 'Updated call discussion notes' : `Failed: ${updateRes.error?.message}`);

  // 5. Verify Unauthenticated Isolation under RLS
  const unauthClient = createClient(supabaseUrl, publishableKey);
  const unauthRes = await unauthClient.from('activities').select('*').eq('id', callId);
  const unauthDenied = unauthRes.data?.length === 0 || !!unauthRes.error;
  record('5. Unauthenticated Call Isolation under RLS', unauthDenied, unauthDenied ? 'Unauthenticated SELECT denied (0 rows returned)' : 'Failed: unauthenticated user could read call log');

  // 6. Delete Call Record
  const deleteRes = await client.from('activities').delete().eq('id', callId);
  const deleteSuccess = !deleteRes.error;
  record('6. Call Record Deletion', deleteSuccess, deleteSuccess ? `Call ${callId} deleted cleanly` : `Failed: ${deleteRes.error?.message}`);

  // Summary
  const allPassed = results.every((r) => r.passed);
  console.log('====================================================');
  console.log(`TOTAL CALL CHECKS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log('CALLS WORKFLOW STATUS:', allPassed ? 'ALL PASS' : 'FAILURES DETECTED');
  console.log('====================================================');

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
