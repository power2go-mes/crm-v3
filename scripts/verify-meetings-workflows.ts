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
  console.log('FINLONEXA CRM v3 — Authenticated Meetings Workflow Verification');
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

  // 2. Schedule Meeting
  const testSubject = `Automated E2E Product Architecture Demo ${Date.now()}`;
  const startTime = new Date(Date.now() + 3600 * 1000).toISOString();
  const endTime = new Date(Date.now() + 7200 * 1000).toISOString();

  const createRes = await client
    .from('activities')
    .insert({
      activity_type: 'meeting',
      subject: testSubject,
      status: 'not_started',
      start_time: startTime,
      end_time: endTime,
      location: 'google_meet',
      meeting_url: 'https://meet.google.com/abc-defg-hij',
      description: 'System demonstration for executive stakeholders.',
      assigned_to_id: adminUser.id,
      created_by_id: adminUser.id,
      related_to_type: 'lead',
    })
    .select()
    .single();

  const created = !createRes.error && !!createRes.data?.id;
  record('2. Meeting Creation with Scheduling & Provider', created, created ? `Created meeting id: ${createRes.data.id}` : `Failed: ${createRes.error?.message}`);
  if (!created) process.exit(1);

  const meetingId = createRes.data.id;

  // 3. Query Meeting Detail with Joined Host Profile
  const detailRes = await client
    .from('activities')
    .select(`
      *,
      assigned_to:user_profiles!assigned_to_id(id, first_name, last_name, email),
      created_by:user_profiles!created_by_id(id, first_name, last_name, email)
    `)
    .eq('id', meetingId)
    .single();

  const detailSuccess = !detailRes.error && detailRes.data?.subject === testSubject && detailRes.data?.assigned_to?.id === adminUser.id;
  record('3. Meeting Detail Query with Host Profile', detailSuccess, detailSuccess ? `Retrieved meeting with host: ${detailRes.data.assigned_to.email}` : `Failed: ${detailRes.error?.message}`);

  // 4. Update Meeting Status to 'completed'
  const updateRes = await client
    .from('activities')
    .update({ status: 'completed' })
    .eq('id', meetingId)
    .select()
    .single();

  const updateSuccess = !updateRes.error && updateRes.data?.status === 'completed';
  record('4. Meeting Status Update (completed)', updateSuccess, updateSuccess ? 'Meeting status transitioned to completed' : `Failed: ${updateRes.error?.message}`);

  // 5. Verify Unauthenticated Isolation under RLS
  const unauthClient = createClient(supabaseUrl, publishableKey);
  const unauthRes = await unauthClient.from('activities').select('*').eq('id', meetingId);
  const unauthDenied = unauthRes.data?.length === 0 || !!unauthRes.error;
  record('5. Unauthenticated Meeting Isolation under RLS', unauthDenied, unauthDenied ? 'Unauthenticated SELECT denied (0 rows returned)' : 'Failed: unauthenticated user could read meeting');

  // 6. Delete Meeting Record
  const deleteRes = await client.from('activities').delete().eq('id', meetingId);
  const deleteSuccess = !deleteRes.error;
  record('6. Meeting Deletion Workflow', deleteSuccess, deleteSuccess ? `Meeting ${meetingId} deleted cleanly` : `Failed: ${deleteRes.error?.message}`);

  // Summary
  const allPassed = results.every((r) => r.passed);
  console.log('====================================================');
  console.log(`TOTAL MEETING CHECKS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log('MEETINGS WORKFLOW STATUS:', allPassed ? 'ALL PASS' : 'FAILURES DETECTED');
  console.log('====================================================');

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
