process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

interface_test: {
  // Common test logger
}

const results = [];
function record(step, passed, details) {
  results.push({ step, passed, details });
  const mark = passed ? '[PASS]' : '[FAIL]';
  console.log(`${mark} ${step}: ${details}`);
}

async function main() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Forecast Database RPC Verification');
  console.log('====================================================');

  const credsPath = path.resolve('C:/Users/izhar/Desktop/crm-v3/.test-credentials.local.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
  const adminEmail = 'test.superadmin@finlonexa.test';
  const adminPassword = creds[adminEmail];

  const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
  const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Authenticate as Super Admin
  const authRes = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authRes.error || !authRes.data.session) {
    record('1. SuperAdmin Authentication', false, `Auth failed: ${authRes.error?.message}`);
    process.exit(1);
  }
  record('1. SuperAdmin Authentication', true, `Authenticated as ${adminEmail}`);

  // 2. Execute forecast_pipeline_metrics RPC
  const { data: metrics, error: metricsErr } = await client.rpc('forecast_pipeline_metrics');
  if (metricsErr) {
    record('2. forecast_pipeline_metrics RPC Execution', false, `RPC failed: ${metricsErr.message}`);
    process.exit(1);
  }
  record('2. forecast_pipeline_metrics RPC Execution', true, 'RPC executed successfully via Supabase PostgREST client');

  // 3. Verify Summary Structure & Integrity
  const s = metrics?.summary;
  const hasRequiredSummaryKeys =
    s &&
    typeof s.unweighted_pipeline === 'number' &&
    typeof s.weighted_pipeline === 'number' &&
    typeof s.closed_won_revenue === 'number' &&
    typeof s.closed_lost_revenue === 'number' &&
    typeof s.total_commit_volume === 'number' &&
    typeof s.open_deals_count === 'number' &&
    typeof s.won_deals_count === 'number' &&
    typeof s.lost_deals_count === 'number' &&
    typeof s.blended_confidence === 'number';

  record(
    '3. Forecast Summary Integrity',
    !!hasRequiredSummaryKeys,
    hasRequiredSummaryKeys
      ? `Summary verified: Unweighted=$${s.unweighted_pipeline}, Weighted=$${s.weighted_pipeline}, Commit=$${s.total_commit_volume}, Deals=${s.open_deals_count}`
      : 'Summary missing required keys'
  );

  // 4. Verify 7-Stage Breakdown Completeness
  const b = metrics?.breakdown;
  const stageIds = b?.map(x => x.id) || [];
  const expectedStages = [
    'prospecting',
    'qualification',
    'needs_analysis',
    'proposal_quote',
    'negotiation',
    'closed_won',
    'closed_lost',
  ];
  const allStagesPresent =
    Array.isArray(b) &&
    b.length === 7 &&
    expectedStages.every((st, idx) => stageIds[idx] === st);

  record(
    '4. 7-Stage Canonical Breakdown Coverage',
    allStagesPresent,
    allStagesPresent
      ? `All 7 canonical stages present in exact pipeline order: [${stageIds.join(', ')}]`
      : `Stage breakdown mismatch: found [${stageIds.join(', ')}]`
  );

  // 5. Unauthenticated Denial Enforcement
  const unauthClient = createClient(supabaseUrl, publishableKey);
  const { data: unauthData, error: unauthErr } = await unauthClient.rpc('forecast_pipeline_metrics');
  const isUnauthDenied = !!unauthErr || !unauthData;
  record(
    '5. Unauthenticated RPC Denial',
    isUnauthDenied,
    isUnauthDenied ? `Unauthenticated call rejected: ${unauthErr?.message || 'Permission denied'}` : 'FAILED: unauthenticated access allowed'
  );

  // 6. Test Date Filtering
  const { data: dateFiltered, error: dateErr } = await client.rpc('forecast_pipeline_metrics', {
    date_from: '2020-01-01',
    date_to: '2020-12-31',
  });
  const dateFilterWorks = !dateErr && dateFiltered?.summary?.open_deals_count === 0;
  record(
    '6. Date Parameter Filtering',
    dateFilterWorks,
    dateFilterWorks
      ? `Filtered historical 2020 date range safely returned 0 deals: Unweighted=$${dateFiltered.summary.unweighted_pipeline}`
      : `Date filter check: ${dateErr?.message || 'Unexpected count'}`
  );

  console.log('====================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log('OVERALL STATUS:', allPassed ? 'ALL PASS' : 'FAILURES DETECTED');
  console.log('====================================================');

  if (!allPassed) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
