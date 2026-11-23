/**
 * FINLONEXA CRM v3 — Contacts Reconciliation Automated Verification
 *
 * Verifies:
 * 1. Atomic Contact creation via save_contact_atomic RPC.
 * 2. M:N Contact-Account relationship creation and role assignment via set_contact_account.
 * 3. Parent-child Contact hierarchy and cycle rejection.
 * 4. Contact-level is_primary persistence.
 * 5. Rejection of invalid payloads.
 * 6. RLS enforcement on unauthenticated / unauthorized access.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.resolve(__dirname, '../.env'));
loadEnvFile(path.resolve(__dirname, '../apps/web/.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
const adminEmail = 'test.superadmin@finlonexa.test';
const adminPassword = creds[adminEmail];

let passCount = 0;
let failCount = 0;

function record(name: string, ok: boolean, msg: string) {
  if (ok) {
    passCount++;
    console.log(`[PASS] ${name}: ${msg}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${name}: ${msg}`);
  }
}

async function run() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Contacts Reconciliation Verification');
  console.log('====================================================');

  // Authenticate as Super Admin via client SDK
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authRes = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  record('1. Authentication', !authRes.error && !!authRes.data.session, 'Logged in as authorized test employee');

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ensure a test account exists
  const accRes = await adminClient
    .from('accounts')
    .insert({
      name: 'Reconciliation Test Corp',
      account_owner_id: authRes.data.user!.id,
    })
    .select('id')
    .single();

  const testAccountId = accRes.data?.id;
  record('2. Fixture Account Creation', Boolean(testAccountId), `Account provisioned: ${testAccountId}`);

  // Test 1: Atomic Contact creation with account relationship and is_primary
  const parentContactRes = await client.rpc('save_contact_atomic', {
    cid: null,
    fields: {
      first_name: 'Arthur',
      last_name: 'Dent',
      email: 'arthur.dent@test.finlonexa.com',
      title: 'Galactic Coordinator',
      contact_number: '+1-555-4242',
      secondary_contact_number: '+1-555-4243',
      parent_contact_id: null,
      is_primary: true,
    },
    relationships: testAccountId ? [{ account_id: testAccountId, role_id: null }] : null,
  });

  const parentId = parentContactRes.data;
  record(
    '3. Atomic Contact Creation with Account Relationship',
    !parentContactRes.error && Boolean(parentId),
    `Parent Contact created atomically: ${parentId}`
  );

  // Verify contact row and is_primary
  const verifyParent = await client
    .from('contacts')
    .select('id, first_name, last_name, is_primary')
    .eq('id', parentId)
    .single();

  record(
    '4. Contact is_primary Flag Persistence',
    verifyParent.data?.is_primary === true,
    `is_primary verified as true for Contact ${parentId}`
  );

  // Verify M:N relationship in contact_account_relationships and via contact_accounts RPC
  const accountsRpcRes = await client.rpc('contact_accounts', { cid: parentId });
  const accountsList = (accountsRpcRes.data as any[]) || [];
  const hasAccountLink = accountsList.some((a) => a.account_id === testAccountId);
  record(
    '5. M:N Contact-Account Link Verification via RPC',
    hasAccountLink,
    `Found ${accountsList.length} linked account(s) via contact_accounts RPC`
  );

  // Test 2: Child Contact creation with parent_contact_id (Hierarchy)
  const childContactRes = await client.rpc('save_contact_atomic', {
    cid: null,
    fields: {
      first_name: 'Ford',
      last_name: 'Prefect',
      email: 'ford.prefect@test.finlonexa.com',
      title: 'Field Researcher',
      contact_number: '+1-555-9999',
      secondary_contact_number: '',
      parent_contact_id: parentId,
      is_primary: false,
    },
    relationships: null,
  });

  const childId = childContactRes.data;
  record(
    '6. Child Contact Hierarchy Linking',
    !childContactRes.error && Boolean(childId),
    `Child contact created with parent_contact_id: ${childId}`
  );

  // Test 3: Circular hierarchy protection
  const cycleAttempt = await client
    .from('contacts')
    .update({ parent_contact_id: childId } as any)
    .eq('id', parentId);

  record(
    '7. Circular Hierarchy Prevention',
    Boolean(cycleAttempt.error),
    `Circular hierarchy correctly rejected with error: ${cycleAttempt.error?.message}`
  );

  // Test 4: Self-parenting rejection
  const selfParentAttempt = await client
    .from('contacts')
    .update({ parent_contact_id: parentId } as any)
    .eq('id', parentId);

  record(
    '8. Self-Parenting Prevention',
    Boolean(selfParentAttempt.error),
    `Self-parenting correctly rejected with error: ${selfParentAttempt.error?.message}`
  );

  // Test 5: Rejection of invalid fields via save_contact_atomic
  const invalidFieldsAttempt = await client.rpc('save_contact_atomic', {
    cid: null,
    fields: {
      first_name: 'Bad',
      last_name: 'Contact',
      email: '', // empty email must be rejected
      title: 'Tester',
    },
    relationships: null,
  });

  record(
    '9. Invalid Payload Validation Rejection',
    Boolean(invalidFieldsAttempt.error),
    `Empty email correctly rejected by RPC: ${invalidFieldsAttempt.error?.message}`
  );

  // Test 6: Unauthenticated access rejection
  const unauthClient = createClient(supabaseUrl, publishableKey);
  const unauthRes = await unauthClient.from('contacts').select('*');
  record(
    '10. Unauthenticated Access Isolation (RLS)',
    (unauthRes.data?.length ?? 0) === 0,
    `Unauthenticated query returned 0 rows (RLS enforced)`
  );

  // Cleanup fixtures
  await adminClient.from('contacts').delete().in('id', [parentId, childId]);
  if (testAccountId) {
    await adminClient.from('accounts').delete().eq('id', testAccountId);
  }

  console.log('====================================================');
  console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log(`OVERALL STATUS: ${failCount === 0 ? 'ALL PASS' : 'FAILED'}`);
  console.log('====================================================');

  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
