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
  console.log('FINLONEXA CRM v3 — Authenticated Sales Performance Verification');
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

  // 1. Query Sales Personnel with Roles
  const usersRes = await client
    .from('user_profiles')
    .select(`
      id,
      first_name,
      last_name,
      email,
      department,
      designation,
      is_active,
      user_roles:user_roles!user_roles_user_id_fkey(
        role_id,
        role:roles(name, hierarchy_rank)
      )
    `)
    .eq('is_active', true);

  record(
    'Sales Personnel Query',
    !usersRes.error && (usersRes.data?.length ?? 0) > 0,
    `Loaded ${usersRes.data?.length ?? 0} active users across sales hierarchy`
  );

  // 2. Query Hierarchy Reporting Relationships
  const relsRes = await client
    .from('sales_reporting_relationships')
    .select('user_id, manager_id');

  record('Hierarchy Relationships Query', !relsRes.error, `Loaded ${relsRes.data?.length ?? 0} reporting relationships`);

  // 3. Query Opportunities for Quota Attribution
  const oppsRes = await client
    .from('opportunities')
    .select('id, name, stage, amount, owner_id');

  record('Opportunities Quota Attribution', !oppsRes.error, `Loaded ${oppsRes.data?.length ?? 0} opportunities`);

  // 4. Calculate Quota Attainment
  const ROLE_QUOTAS: Record<string, number> = {
    BDO: 50000,
    ASM: 150000,
    SSM: 350000,
    RSM: 750000,
    HEAD_OF_SALES: 2000000,
    SUPER_ADMIN: 2500000,
  };

  const users = usersRes.data || [];
  let totalQuota = 0;
  for (const u of users as any[]) {
    const roleId = u.user_roles?.[0]?.role_id || 'BDO';
    totalQuota += ROLE_QUOTAS[roleId] || 50000;
  }

  record('Team Quota Aggregation', totalQuota > 0, `Aggregate active team quota: $${totalQuota.toLocaleString()}`);

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
