/**
 * FINLONEXA CRM v3 — Development Test Accounts Provisioner
 * 
 * Provision and verify 15 deterministic development test employees across
 * the six canonical roles and two independent sales hierarchy branches.
 * 
 * Safety:
 * - Strictly guarded to development project ref (bpwdxslrkgmcoewkwufu).
 * - Never prints passwords or secret tokens.
 * - Stores credentials in gitignored `.test-credentials.local.json`.
 * - Idempotent: safe to run multiple times without duplicated state.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 1. Environment and Safety Verification
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

// Load root .env and apps/web/.env.local
loadEnvFile(path.resolve(__dirname, '../.env'));
loadEnvFile(path.resolve(__dirname, '../apps/web/.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// SAFETY GUARD: Must explicitly match verified dev environment
const DEV_PROJECT_REF = 'bpwdxslrkgmcoewkwufu';
if (!SUPABASE_URL.includes(DEV_PROJECT_REF)) {
  console.error(`[FATAL SAFETY ABORT] Expected development project ref '${DEV_PROJECT_REF}', but got URL: ${SUPABASE_URL}`);
  process.exit(1);
}

if (!SERVICE_KEY || SERVICE_KEY.includes('placeholder')) {
  console.error('[FATAL SAFETY ABORT] Missing or placeholder SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 2. Local Credential Storage
const CREDENTIALS_FILE = path.resolve(__dirname, '../.test-credentials.local.json');

function getStoredCredentials(): Record<string, string> {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveStoredCredentials(creds: Record<string, string>) {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function getOrGeneratePassword(email: string, stored: Record<string, string>): string {
  if (stored[email]) {
    return stored[email];
  }
  // Generate secure 24-character password satisfying strong auth requirements
  const raw = crypto.randomBytes(16).toString('base64url');
  const password = `Finlo#${raw.slice(0, 14)}!9`;
  stored[email] = password;
  return password;
}

// 3. Test Account & Hierarchy Specification
interface TestEmployeeSpec {
  prefix: string;
  email: string;
  roleId: 'SUPER_ADMIN' | 'HEAD_OF_SALES' | 'RSM' | 'SSM' | 'ASM' | 'BDO';
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  managerPrefix?: string;
  regionCode?: string; // 'REG-NORTH' or 'REG-SOUTH'
  teamName?: string;
}

const TEST_DOMAIN = 'finlonexa.test';

const TEST_EMPLOYEES: TestEmployeeSpec[] = [
  // Top Management
  {
    prefix: 'test.superadmin',
    email: `test.superadmin@${TEST_DOMAIN}`,
    roleId: 'SUPER_ADMIN',
    firstName: 'Sarah',
    lastName: 'Admin',
    department: 'Executive Management',
    designation: 'Chief Executive Officer',
  },
  {
    prefix: 'test.headofsales',
    email: `test.headofsales@${TEST_DOMAIN}`,
    roleId: 'HEAD_OF_SALES',
    firstName: 'Harry',
    lastName: 'Sales',
    department: 'Sales Leadership',
    designation: 'Vice President & Head of Global Sales',
    managerPrefix: 'test.superadmin',
  },

  // Branch 1: North Region (REG-NORTH)
  {
    prefix: 'test.rsm1',
    email: `test.rsm1@${TEST_DOMAIN}`,
    roleId: 'RSM',
    firstName: 'Robert',
    lastName: 'North',
    department: 'Regional Sales',
    designation: 'Regional Sales Manager — North',
    managerPrefix: 'test.headofsales',
    regionCode: 'REG-NORTH',
  },
  {
    prefix: 'test.ssm1',
    email: `test.ssm1@${TEST_DOMAIN}`,
    roleId: 'SSM',
    firstName: 'Samuel',
    lastName: 'Metro',
    department: 'Commercial Sales',
    designation: 'Senior Sales Manager — Metro North',
    managerPrefix: 'test.rsm1',
    regionCode: 'REG-NORTH',
  },
  {
    prefix: 'test.asm1',
    email: `test.asm1@${TEST_DOMAIN}`,
    roleId: 'ASM',
    firstName: 'Arthur',
    lastName: 'City',
    department: 'Field Sales',
    designation: 'Area Sales Manager — North City',
    managerPrefix: 'test.ssm1',
    regionCode: 'REG-NORTH',
    teamName: 'North Corporate Sales',
  },
  {
    prefix: 'test.bdo1',
    email: `test.bdo1@${TEST_DOMAIN}`,
    roleId: 'BDO',
    firstName: 'Brian',
    lastName: 'Officer1',
    department: 'Field Sales',
    designation: 'Business Development Officer',
    managerPrefix: 'test.asm1',
    regionCode: 'REG-NORTH',
    teamName: 'North Corporate Sales',
  },
  {
    prefix: 'test.bdo2',
    email: `test.bdo2@${TEST_DOMAIN}`,
    roleId: 'BDO',
    firstName: 'Bella',
    lastName: 'Officer2',
    department: 'Field Sales',
    designation: 'Business Development Officer',
    managerPrefix: 'test.asm1',
    regionCode: 'REG-NORTH',
    teamName: 'North Corporate Sales',
  },
  {
    prefix: 'test.asm2',
    email: `test.asm2@${TEST_DOMAIN}`,
    roleId: 'ASM',
    firstName: 'Alice',
    lastName: 'Suburbs',
    department: 'Field Sales',
    designation: 'Area Sales Manager — North Suburbs',
    managerPrefix: 'test.ssm1',
    regionCode: 'REG-NORTH',
    teamName: 'North Corporate Sales',
  },
  {
    prefix: 'test.bdo3',
    email: `test.bdo3@${TEST_DOMAIN}`,
    roleId: 'BDO',
    firstName: 'Ben',
    lastName: 'Officer3',
    department: 'Field Sales',
    designation: 'Business Development Officer',
    managerPrefix: 'test.asm2',
    regionCode: 'REG-NORTH',
    teamName: 'North Corporate Sales',
  },
  {
    prefix: 'test.bdo4',
    email: `test.bdo4@${TEST_DOMAIN}`,
    roleId: 'BDO',
    firstName: 'Brooke',
    lastName: 'Officer4',
    department: 'Field Sales',
    designation: 'Business Development Officer',
    managerPrefix: 'test.asm2',
    regionCode: 'REG-NORTH',
    teamName: 'North Corporate Sales',
  },

  // Branch 2: South Region (REG-SOUTH)
  {
    prefix: 'test.rsm2',
    email: `test.rsm2@${TEST_DOMAIN}`,
    roleId: 'RSM',
    firstName: 'Rachel',
    lastName: 'South',
    department: 'Regional Sales',
    designation: 'Regional Sales Manager — South',
    managerPrefix: 'test.headofsales',
    regionCode: 'REG-SOUTH',
  },
  {
    prefix: 'test.ssm2',
    email: `test.ssm2@${TEST_DOMAIN}`,
    roleId: 'SSM',
    firstName: 'Sophia',
    lastName: 'Coast',
    department: 'Commercial Sales',
    designation: 'Senior Sales Manager — Coast South',
    managerPrefix: 'test.rsm2',
    regionCode: 'REG-SOUTH',
  },
  {
    prefix: 'test.asm3',
    email: `test.asm3@${TEST_DOMAIN}`,
    roleId: 'ASM',
    firstName: 'Adam',
    lastName: 'Harbor',
    department: 'Field Sales',
    designation: 'Area Sales Manager — South Harbor',
    managerPrefix: 'test.ssm2',
    regionCode: 'REG-SOUTH',
    teamName: 'South Commercial Sales',
  },
  {
    prefix: 'test.bdo5',
    email: `test.bdo5@${TEST_DOMAIN}`,
    roleId: 'BDO',
    firstName: 'Brandon',
    lastName: 'Officer5',
    department: 'Field Sales',
    designation: 'Business Development Officer',
    managerPrefix: 'test.asm3',
    regionCode: 'REG-SOUTH',
    teamName: 'South Commercial Sales',
  },
  {
    prefix: 'test.bdo6',
    email: `test.bdo6@${TEST_DOMAIN}`,
    roleId: 'BDO',
    firstName: 'Bianca',
    lastName: 'Officer6',
    department: 'Field Sales',
    designation: 'Business Development Officer',
    managerPrefix: 'test.asm3',
    regionCode: 'REG-SOUTH',
    teamName: 'South Commercial Sales',
  },
];

async function main() {
  console.log('=============================================================================');
  console.log('FINLONEXA CRM v3 — Test Accounts & Sales Hierarchy Provisioner');
  console.log(`Target: ${SUPABASE_URL} (Project: ${DEV_PROJECT_REF})`);
  console.log('=============================================================================');

  const storedCreds = getStoredCredentials();

  // 1. Fetch Sales Regions and Teams lookups
  const { data: regions } = await adminClient.from('sales_regions').select('id, code, name');
  const regionMap = new Map((regions || []).map((r: any) => [r.code, r.id]));

  const { data: teams } = await adminClient.from('sales_teams').select('id, name, region_id');
  const teamMap = new Map((teams || []).map((t: any) => [t.name, t.id]));

  // 2. Fetch existing auth users to ensure idempotency
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 100 });
  if (listError) {
    throw new Error(`Failed to list existing auth users: ${listError.message}`);
  }
  const existingUsersByEmail = new Map((listData.users || []).map((u) => [u.email?.toLowerCase(), u]));

  const userIdMap = new Map<string, string>(); // prefix -> userId
  let createdCount = 0;
  let reusedCount = 0;

  // 3. Step A: Provision Auth Users, Profiles, and Roles
  console.log('\n[Phase 1/3] Provisioning 15 Test Employee Auth Identities & Roles:');
  for (const emp of TEST_EMPLOYEES) {
    const password = getOrGeneratePassword(emp.email, storedCreds);
    let userId: string;

    const existing = existingUsersByEmail.get(emp.email.toLowerCase());
    if (existing) {
      userId = existing.id;
      reusedCount++;
      // Ensure email confirmed
      await adminClient.auth.admin.updateUserById(userId, {
        email_confirm: true,
        user_metadata: { first_name: emp.firstName, last_name: emp.lastName },
      });
      console.log(`  [REUSED]  ${emp.prefix} (${emp.roleId}) -> Auth ID: ${userId}`);
    } else {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: emp.email,
        password,
        email_confirm: true,
        user_metadata: { first_name: emp.firstName, last_name: emp.lastName },
      });

      if (createError || !newUser.user) {
        throw new Error(`Failed to create auth identity for ${emp.email}: ${createError?.message}`);
      }
      userId = newUser.user.id;
      createdCount++;
      console.log(`  [CREATED] ${emp.prefix} (${emp.roleId}) -> Auth ID: ${userId}`);
    }

    userIdMap.set(emp.prefix, userId);

    // Upsert User Profile
    const { error: profileError } = await adminClient.from('user_profiles').upsert({
      id: userId,
      email: emp.email,
      first_name: emp.firstName,
      last_name: emp.lastName,
      department: emp.department,
      designation: emp.designation,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      throw new Error(`Failed to upsert user_profile for ${emp.email}: ${profileError.message}`);
    }

    // Assign Canonical Role (delete any stale, insert exact role)
    await adminClient.from('user_roles').delete().eq('user_id', userId);
    const { error: roleError } = await adminClient.from('user_roles').insert({
      user_id: userId,
      role_id: emp.roleId,
    });

    if (roleError) {
      throw new Error(`Failed to assign role ${emp.roleId} to ${emp.email}: ${roleError.message}`);
    }
  }

  saveStoredCredentials(storedCreds);

  // 4. Step B: Build Sales Hierarchy Reporting Relationships (Bottom-Up or Top-Down)
  console.log('\n[Phase 2/3] Establishing Two-Branch Sales Reporting Hierarchy:');
  // Order of relationship establishment: Top down so managers exist before subordinates
  for (const emp of TEST_EMPLOYEES) {
    const userId = userIdMap.get(emp.prefix)!;
    const managerId = emp.managerPrefix ? userIdMap.get(emp.managerPrefix) : null;
    const regionId = emp.regionCode ? regionMap.get(emp.regionCode) || null : null;
    const teamId = emp.teamName ? teamMap.get(emp.teamName) || null : null;

    const { error: relError } = await adminClient.from('sales_reporting_relationships').upsert(
      {
        user_id: userId,
        manager_id: managerId,
        region_id: regionId,
        team_id: teamId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (relError) {
      throw new Error(`Hierarchy creation failed for ${emp.prefix} reporting to ${emp.managerPrefix}: ${relError.message}`);
    }

    const managerLabel = emp.managerPrefix ? `${emp.managerPrefix} (${userIdMap.get(emp.managerPrefix)})` : 'None (Top Leader)';
    const regionLabel = emp.regionCode || 'Company-Wide';
    console.log(`  [HIERARCHY] ${emp.prefix.padEnd(18)} reports to -> ${managerLabel.padEnd(25)} [${regionLabel}]`);
  }

  // 5. Step C: Verify Live Authentication For All 15 Accounts
  console.log('\n[Phase 3/3] Verifying Live Supabase Authentication & Usability:');
  let authSuccessCount = 0;
  for (const emp of TEST_EMPLOYEES) {
    const password = storedCreds[emp.email];
    if (!password) {
      throw new Error(`Missing stored credential for ${emp.email}`);
    }

    const testClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
      email: emp.email,
      password,
    });

    if (authError || !authData.session) {
      console.error(`  [FAIL] ${emp.prefix.padEnd(18)} (${emp.roleId}): Login failed - ${authError?.message}`);
    } else {
      authSuccessCount++;
      console.log(`  [PASS] ${emp.prefix.padEnd(18)} (${emp.roleId}): Login successful. Token issued for user ${authData.user.id}`);
    }
  }

  console.log('\n=============================================================================');
  console.log(`PROVISIONING SUMMARY:`);
  console.log(`  - Total Specified Accounts: ${TEST_EMPLOYEES.length}`);
  console.log(`  - Newly Created:            ${createdCount}`);
  console.log(`  - Reused / Updated:         ${reusedCount}`);
  console.log(`  - Hierarchy Assigned:       ${TEST_EMPLOYEES.length}`);
  console.log(`  - Auth Sign-In Validated:   ${authSuccessCount} / ${TEST_EMPLOYEES.length}`);
  console.log(`  - Credentials Saved:        .test-credentials.local.json (Mode: 0600, Git-Excluded)`);
  console.log('=============================================================================\n');
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
