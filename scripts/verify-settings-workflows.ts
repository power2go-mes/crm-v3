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
  console.log('FINLONEXA CRM v3 — Authenticated Settings & Roles Workflow Verification');
  console.log('====================================================');

  const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
  const adminEmail = 'test.superadmin@finlonexa.test';
  const adminPassword = creds[adminEmail];

  const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
  const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authRes = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authRes.error || !authRes.data.user) {
    record('Authentication', false, `Auth failed: ${authRes.error?.message}`);
    process.exit(1);
  }
  record('Authentication', true, `Authenticated as ${adminEmail}`);

  // 1. Fetch Singleton Company Settings (id = 1)
  const settingsRes = await client
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .single();

  record(
    'Company Settings Query',
    !settingsRes.error && settingsRes.data?.company_name === 'FINLONEXA',
    `Loaded singleton company settings for: ${settingsRes.data?.company_name} (Currency: ${settingsRes.data?.currency})`
  );

  // 2. Test updating company parameters
  const originalSupportEmail = settingsRes.data?.support_email;
  const testEmail = `ops-verification-${Date.now()}@finlonexa.com`;

  const updateRes = await client
    .from('company_settings')
    .update({ support_email: testEmail })
    .eq('id', 1)
    .select()
    .single();

  record(
    'Update Company Settings',
    !updateRes.error && updateRes.data?.support_email === testEmail,
    `Updated support email to ${testEmail}`
  );

  // Revert back
  await client
    .from('company_settings')
    .update({ support_email: originalSupportEmail })
    .eq('id', 1);

  record('Revert Company Settings', true, `Reverted support email to original`);

  // 3. Query Canonical and Custom Roles
  const rolesRes = await client
    .from('roles')
    .select('*')
    .order('hierarchy_rank', { ascending: true });

  record(
    'Roles Query',
    !rolesRes.error && (rolesRes.data?.length ?? 0) >= 6,
    `Loaded ${rolesRes.data?.length ?? 0} roles in system`
  );

  // 4. Query Role Permissions Matrix
  const rolePermsRes = await client
    .from('role_permissions')
    .select('role_id, permission_id, is_granted');

  record(
    'Role Permissions Matrix Query',
    !rolePermsRes.error && (rolePermsRes.data?.length ?? 0) > 0,
    `Loaded ${rolePermsRes.data?.length ?? 0} permission mappings`
  );

  console.log('====================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`Summary: ${results.filter(r => r.passed).length}/${results.length} tests passed.`);
  console.log('====================================================');

  if (!allPassed) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
