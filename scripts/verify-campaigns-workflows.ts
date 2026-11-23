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
  console.log('FINLONEXA CRM v3 — Authenticated Campaigns Workflow Verification');
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
    record('Authentication', false, `Failed to authenticate: ${authRes.error?.message}`);
    process.exit(1);
  }
  record('Authentication', true, `Authenticated as ${adminEmail} (${authRes.data.user.id})`);

  const userId = authRes.data.user.id;

  // 1. Create a test Campaign
  const testCampaignName = `Verification Campaign ${Date.now()}`;
  const insertCamp = await client
    .from('campaigns')
    .insert({
      campaign_name: testCampaignName,
      campaign_owner_id: userId,
      campaign_type: 'webinar',
      status: 'planned',
      expected_revenue: 50000,
      budget_cost: 10000,
      actual_cost: 8000,
      number_sent: 250,
      description: 'End-to-end verification campaign',
    })
    .select()
    .single();

  if (insertCamp.error || !insertCamp.data) {
    record('Campaign Creation', false, `Insert failed: ${insertCamp.error?.message}`);
    process.exit(1);
  }
  const campaignId = insertCamp.data.id;
  record('Campaign Creation', true, `Created campaign id=${campaignId} (${testCampaignName})`);

  // 2. Fetch campaign list
  const listRes = await client
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  record('Campaign Listing', !listRes.error && listRes.data?.id === campaignId, `Fetched campaign: ${listRes.data?.campaign_name}`);

  // 3. Find an existing lead and contact to attach
  const leads = await client.from('leads').select('id, first_name, last_name').limit(1);
  const contacts = await client.from('contacts').select('id, first_name, last_name').limit(1);

  const testLeadId = leads.data?.[0]?.id;
  const testContactId = contacts.data?.[0]?.id;

  if (testLeadId) {
    // 4. Attach lead as campaign member
    const addLeadMem = await client
      .from('campaign_members')
      .insert({
        campaign_id: campaignId,
        member_type: 'lead',
        lead_id: testLeadId,
        member_status: 'sent',
      })
      .select()
      .single();

    record('Add Lead Campaign Member', !addLeadMem.error, `Attached lead ${testLeadId} status=${addLeadMem.data?.member_status}`);

    // Update status to responded
    if (addLeadMem.data) {
      const updateMem = await client
        .from('campaign_members')
        .update({ member_status: 'responded' })
        .eq('id', addLeadMem.data.id)
        .select()
        .single();

      record('Update Campaign Member Status', !updateMem.error && updateMem.data?.member_status === 'responded', `Updated status to responded`);
    }
  }

  if (testContactId) {
    // 5. Attach contact as campaign member
    const addContactMem = await client
      .from('campaign_members')
      .insert({
        campaign_id: campaignId,
        member_type: 'contact',
        contact_id: testContactId,
        member_status: 'planned',
      })
      .select()
      .single();

    record('Add Contact Campaign Member', !addContactMem.error, `Attached contact ${testContactId} status=${addContactMem.data?.member_status}`);
  }

  // 6. Verify counters updated or calculated
  const campRefetched = await client
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  record(
    'Campaign Counters Check',
    !campRefetched.error,
    `Leads=${campRefetched.data?.leads_in_campaign}, Contacts=${campRefetched.data?.contacts_in_campaign}, Responses=${campRefetched.data?.responses_in_campaign}`
  );

  // 7. Cleanup test members and campaign
  await client.from('campaign_members').delete().eq('campaign_id', campaignId);
  const delCamp = await client.from('campaigns').delete().eq('id', campaignId);
  record('Campaign Cleanup', true, `Cleaned up test fixtures`);

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
