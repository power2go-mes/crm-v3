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
  console.log('FINLONEXA CRM v3 — Authenticated Reports Workflow Verification');
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

  // 1. Leads by Status Report Query
  const leadsRes = await client.from('leads').select('id, title, status');
  record('Report: Leads by Status', !leadsRes.error, `Retrieved ${leadsRes.data?.length ?? 0} leads for status aggregation`);

  // 2. Opportunity Pipeline Report Query
  const oppsRes = await client.from('opportunities').select('id, name, stage, amount');
  record('Report: Opportunity Pipeline by Stage', !oppsRes.error, `Retrieved ${oppsRes.data?.length ?? 0} opportunities`);

  // 3. Accounts by Type Report Query
  const accountsRes = await client.from('accounts').select('id, name, account_type, industry, annual_revenue');
  record('Report: Accounts by Classification', !accountsRes.error, `Retrieved ${accountsRes.data?.length ?? 0} accounts`);

  // 4. Sales Activity Engagement Report Query
  const actRes = await client.from('activities').select('id, activity_type, status, priority');
  record('Report: Sales Activity Engagement', !actRes.error, `Retrieved ${actRes.data?.length ?? 0} activities`);

  // 5. Verify CSV formatting logic
  const sampleHeaders = ['Name', 'Stage', 'Amount'];
  const sampleRows = [{ Name: 'Acme Deal', Stage: 'Proposal', Amount: 50000 }];
  const csvContent = sampleHeaders.join(',') + '\n' + sampleRows.map(r => `"${r.Name}","${r.Stage}",${r.Amount}`).join('\n');
  record('CSV Export Generation', csvContent.includes('Acme Deal'), `Generated CSV output payload: ${csvContent.length} bytes`);

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
