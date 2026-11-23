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
  console.log('FINLONEXA CRM v3 — Authenticated Tasks Workflow Verification');
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

  // 2. Create Task
  const testSubject = `Automated E2E Verification Task ${Date.now()}`;
  const createRes = await client
    .from('activities')
    .insert({
      activity_type: 'task',
      subject: testSubject,
      description: 'E2E automated testing of Tasks workflows and RLS',
      priority: 'high',
      status: 'not_started',
      due_date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      assigned_to_id: adminUser.id,
      created_by_id: adminUser.id,
      related_to_type: 'lead',
    })
    .select()
    .single();

  const created = !createRes.error && !!createRes.data?.id;
  record('2. Task Creation with Metadata & Relations', created, created ? `Created task id: ${createRes.data.id}` : `Failed: ${createRes.error?.message}`);
  if (!created) process.exit(1);

  const taskId = createRes.data.id;

  // 3. Query Task Detail with Joins
  const detailRes = await client
    .from('activities')
    .select(`
      *,
      assigned_to:user_profiles!assigned_to_id(id, first_name, last_name, email),
      created_by:user_profiles!created_by_id(id, first_name, last_name, email)
    `)
    .eq('id', taskId)
    .single();

  const detailSuccess = !detailRes.error && detailRes.data?.subject === testSubject && detailRes.data?.assigned_to?.id === adminUser.id;
  record('3. Task Detail Query with Joined Assignee Profile', detailSuccess, detailSuccess ? `Retrieved task with assignee: ${detailRes.data.assigned_to.email}` : `Failed: ${detailRes.error?.message}`);

  // 4. Update Task Status (Transition from not_started to in_progress)
  const updateStatusRes = await client
    .from('activities')
    .update({ status: 'in_progress' })
    .eq('id', taskId)
    .select()
    .single();

  const statusSuccess = !updateStatusRes.error && updateStatusRes.data?.status === 'in_progress';
  record('4. Task Status Transition (in_progress)', statusSuccess, statusSuccess ? `Updated status to: ${updateStatusRes.data.status}` : `Failed: ${updateStatusRes.error?.message}`);

  // 5. Complete Task (Transition to completed)
  const completeRes = await client
    .from('activities')
    .update({ status: 'completed' })
    .eq('id', taskId)
    .select()
    .single();

  const completeSuccess = !completeRes.error && completeRes.data?.status === 'completed';
  record('5. Task Completion Workflow', completeSuccess, completeSuccess ? 'Task marked as completed' : `Failed: ${completeRes.error?.message}`);

  // 6. Test Unauthenticated Access Rejection under RLS
  const unauthClient = createClient(supabaseUrl, publishableKey);
  const unauthRes = await unauthClient.from('activities').select('*').eq('id', taskId);
  const unauthDenied = unauthRes.data?.length === 0 || !!unauthRes.error;
  record('6. Unauthenticated Activity Isolation under RLS', unauthDenied, unauthDenied ? 'Unauthenticated SELECT denied (0 rows returned)' : 'Failed: unauthenticated user could read task');

  // 7. Delete Task
  const deleteRes = await client.from('activities').delete().eq('id', taskId);
  const deleteSuccess = !deleteRes.error;
  record('7. Task Deletion Workflow', deleteSuccess, deleteSuccess ? `Task ${taskId} deleted cleanly` : `Failed: ${deleteRes.error?.message}`);

  // Verify deletion confirmed
  const verifyDelRes = await client.from('activities').select('id').eq('id', taskId);
  const verifyDelSuccess = verifyDelRes.data?.length === 0;
  record('8. Deletion Verification', verifyDelSuccess, verifyDelSuccess ? 'Task no longer exists in database' : 'Failed: task still exists');

  // Summary
  const allPassed = results.every((r) => r.passed);
  console.log('====================================================');
  console.log(`TOTAL WORKFLOW CHECKS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log('TASKS WORKFLOW STATUS:', allPassed ? 'ALL PASS' : 'FAILURES DETECTED');
  console.log('====================================================');

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
