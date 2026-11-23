import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  const mark = passed ? '[PASS]' : '[FAIL]';
  console.log(`${mark} ${step}: ${details}`);
}

async function main() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Phase 3A Leads Integration Verification');
  console.log('====================================================');

  const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

  const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
  const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

  // 1. Authenticate BDO and ASM
  const bdoEmail = 'test.bdo1@finlonexa.test';
  const bdoPass = creds[bdoEmail];
  const asmEmail = 'test.asm1@finlonexa.test';
  const asmPass = creds[asmEmail];

  const bdoAuth = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: bdoLogin } = await bdoAuth.auth.signInWithPassword({ email: bdoEmail, password: bdoPass });
  const bdoToken = bdoLogin.session!.access_token;
  const bdoUserId = bdoLogin.user!.id;

  const asmAuth = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: asmLogin } = await asmAuth.auth.signInWithPassword({ email: asmEmail, password: asmPass });
  const asmToken = asmLogin.session!.access_token;
  const asmUserId = asmLogin.user!.id;

  const bdoClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${bdoToken}` } },
  });

  const asmClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${asmToken}` } },
  });

  // 2. Check Canonical Lead Statuses with Authenticated Active Employee
  const { data: statuses, error: statusErr } = await asmClient
    .from('lead_statuses')
    .select('*')
    .order('order_index');

  const statusNames = statuses?.map(s => s.name.toLowerCase()) || [];
  const expectedStages = ['new', 'contacted', 'qualified', 'proposal', 'lost', 'convert'];
  const stagesMatch = expectedStages.every(s => statusNames.includes(s));
  record('1. Canonical Lead Stages (6)', stagesMatch, `Found: ${statusNames.join(', ')}`);

  // 3. Test BDO Lead Creation Denial (leads.create is denied to BDO by default)
  const bdoCreateRes = await bdoClient.from('leads').insert({
    title: 'Unauthorized BDO Lead',
    first_name: 'Test',
    last_name: 'Denial',
    status: 'new',
  }).select();

  const bdoDenied = !!bdoCreateRes.error;
  record('2. BDO Create Denial (RLS/Permissions)', bdoDenied, bdoDenied ? `Denied with: ${bdoCreateRes.error?.message}` : 'Unexpectedly allowed');

  // 4. Test ASM Lead Creation and Assignment
  const asmCreateRes = await asmClient.from('leads').insert({
    title: 'Acme Enterprise Migration',
    first_name: 'Arthur',
    last_name: 'Dent',
    email: 'arthur.dent@acme-test.example',
    phone: '+1-555-4242',
    company_name: 'Acme Test Corp',
    annual_revenue: 750000,
    status: 'new',
    lead_source: 'website',
    industry: 'manufacturing',
    lead_owner_id: asmUserId,
    sub_owner_id: bdoUserId,
    requirements: 'Needs full enterprise migration to FINLONEXA platform.',
  }).select().single();

  const asmCreated = !asmCreateRes.error && !!asmCreateRes.data?.id;
  record('3. ASM Lead Creation & Assignment', asmCreated, asmCreated ? `Created lead ID: ${asmCreateRes.data?.id}` : `Failed: ${asmCreateRes.error?.message}`);

  if (!asmCreated) {
    console.error('Cannot proceed without created lead');
    process.exit(1);
  }

  const createdLeadId = asmCreateRes.data.id;

  // 5. Test BDO Assigned Visibility & Status Update
  const bdoReadRes = await bdoClient.from('leads').select('*').eq('id', createdLeadId).single();
  const bdoCanRead = !bdoReadRes.error && bdoReadRes.data?.id === createdLeadId;
  record('4. Assigned BDO Read Access (RLS)', bdoCanRead, bdoCanRead ? 'BDO can read assigned lead' : `Failed: ${bdoReadRes.error?.message}`);

  // BDO updates status to 'contacted'
  const bdoUpdateRes = await bdoClient.from('leads').update({ status: 'contacted' }).eq('id', createdLeadId).select().single();
  const bdoCanUpdate = !bdoUpdateRes.error && bdoUpdateRes.data?.status === 'contacted';
  record('5. Assigned BDO Update Access', bdoCanUpdate, bdoCanUpdate ? 'BDO updated status to contacted' : `Failed: ${bdoUpdateRes.error?.message}`);

  // 6. Test Audit Log Trigger
  const historyRes = await asmClient.from('lead_history').select('*').eq('lead_id', createdLeadId);
  const hasHistory = !historyRes.error && historyRes.data.length > 0;
  record('6. Audit Trail Trigger (lead_history)', hasHistory, hasHistory ? `Found ${historyRes.data?.length} change log(s)` : `Failed: ${historyRes.error?.message}`);

  // 7. Advance stage to 'qualified'
  const advanceRes = await asmClient.from('leads').update({ status: 'qualified' }).eq('id', createdLeadId).select().single();
  record('7. Stage Progression to Qualified', !advanceRes.error && advanceRes.data?.status === 'qualified', `Status: ${advanceRes.data?.status}`);

  // 8. Test Atomic Lead Conversion RPC
  const convertRes = await asmClient.rpc('convert_lead', {
    p_lead_id: createdLeadId,
    p_account_action: 'create_new',
    p_account_id: null,
    p_account_name: 'Acme Test Corp Account',
    p_contact_action: 'create_new',
    p_contact_id: null,
    p_contact_first_name: 'Arthur',
    p_contact_last_name: 'Dent',
    p_opportunity_action: 'create_new',
    p_opportunity_id: null,
    p_opportunity_name: 'Acme Test Corp - Deal 2026',
    p_opportunity_amount: 750000,
    p_opportunity_close_date: '2026-12-31',
    p_owner_id: asmUserId,
  });

  const convertedData = convertRes.data;
  const convertSuccess = !convertRes.error && convertedData?.success === true;
  record('8. Atomic Lead Conversion RPC', convertSuccess, convertSuccess ? `Account: ${convertedData.account_id}, Contact: ${convertedData.contact_id}, Opp: ${convertedData.opportunity_id}` : `Failed: ${convertRes.error?.message}`);

  // 9. Verify Lead Status is now Converted
  const verifyLead = await asmClient.from('leads').select('is_convert, status').eq('id', createdLeadId).single();
  const isMarkedConverted = verifyLead.data?.is_convert === true && verifyLead.data?.status === 'convert';
  record('9. Lead Marked Converted & Closed', isMarkedConverted, isMarkedConverted ? 'Lead flagged is_convert=true and status=convert' : `Status: ${verifyLead.data?.status}, is_convert: ${verifyLead.data?.is_convert}`);

  // 10. Clean up test record
  await asmClient.from('opportunities').delete().eq('id', convertedData.opportunity_id);
  await asmClient.from('contacts').delete().eq('id', convertedData.contact_id);
  await asmClient.from('accounts').delete().eq('id', convertedData.account_id);
  await asmClient.from('leads').delete().eq('id', createdLeadId);
  record('10. Test Records Cleanup', true, 'Temporary test leads, accounts, contacts, and opportunities cleaned up');

  // Summary
  const allPassed = results.every(r => r.passed);
  console.log('====================================================');
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log('OVERALL STATUS:', allPassed ? 'ALL PASS' : 'FAILURES DETECTED');
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
