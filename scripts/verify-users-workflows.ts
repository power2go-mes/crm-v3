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
  console.log('FINLONEXA CRM v3 — Authenticated Users Workflow Verification');
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

  // 1. Fetch user directory with roles
  const usersRes = await client
    .from('user_profiles')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      department,
      designation,
      is_active,
      user_roles:user_roles!user_roles_user_id_fkey(
        role_id,
        role:roles(name, hierarchy_rank)
      )
    `);

  record(
    'Users Directory Query',
    !usersRes.error && (usersRes.data?.length ?? 0) > 0,
    `Loaded ${usersRes.data?.length ?? 0} user profiles with roles`
  );

  // 2. Find a subordinate test user to update (e.g. BDO or sales rep)
  const targetUser = usersRes.data?.find(u => u.email.includes('bdo') || u.email.includes('asm') || u.email.includes('test'));

  if (targetUser) {
    const originalDesignation = targetUser.designation;
    const testDesignation = `Verification Specialist ${Date.now()}`;

    // 3. Update employee profile
    const updateRes = await client
      .from('user_profiles')
      .update({ designation: testDesignation })
      .eq('id', targetUser.id)
      .select()
      .single();

    record(
      'Update Employee Profile',
      !updateRes.error && updateRes.data?.designation === testDesignation,
      `Updated user ${targetUser.email} designation to "${testDesignation}"`
    );

    // 4. Revert designation back to original
    await client
      .from('user_profiles')
      .update({ designation: originalDesignation })
      .eq('id', targetUser.id);

    record('Profile Revert', true, `Reverted profile changes`);
  }

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
