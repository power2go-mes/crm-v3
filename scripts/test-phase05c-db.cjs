process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8')
    .split(/\r?\n/)
    .find(v => /^DATABASE_URL\s*=/.test(v));
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Testing Phase 05C Database Objects ---');

  // Test 1: Closed Lost Reason validation
  console.log('\n[Test 1] Closed Lost Reason Trigger Validation:');
  const userRes = await client.query('select id from user_profiles limit 1');
  const userId = userRes.rows[0].id;

  const oppRes = await client.query(`
    insert into public.opportunities (name, stage, amount, probability, close_date, owner_id)
    values ('Test Opp Phase 05C', 'prospecting', 50000, 20, current_date + 30, $1)
    returning id, stage;
  `, [userId]);
  const testOppId = oppRes.rows[0].id;
  console.log('Created test opp:', testOppId);

  // Attempt to set stage = 'closed_lost' WITHOUT lost_reason (should fail)
  let failedAsExpected = false;
  try {
    await client.query(`
      update public.opportunities
      set stage = 'closed_lost'
      where id = $1;
    `, [testOppId]);
  } catch (err) {
    failedAsExpected = true;
    console.log('Expected failure caught:', err.message);
  }
  if (!failedAsExpected) throw new Error('Failed: Closed lost without lost_reason should have thrown error');

  // Now set stage = 'closed_lost' WITH lost_reason (should succeed)
  await client.query(`
    update public.opportunities
    set stage = 'closed_lost',
        lost_reason = 'competitor',
        competitor_name = 'Acme Corp',
        lost_reason_details = 'Lower pricing from competitor'
    where id = $1;
  `, [testOppId]);
  console.log('Successfully transitioned to closed_lost with lost_reason');

  // Check loss history record
  const historyRes = await client.query(`
    select * from public.crm_opportunity_loss_history where opportunity_id = $1;
  `, [testOppId]);
  console.log('Loss history recorded:', historyRes.rows.length, 'entries');
  if (historyRes.rows.length !== 1 || historyRes.rows[0].competitor_name !== 'Acme Corp') {
    throw new Error('Loss history record mismatch');
  }

  // Test Reopen
  console.log('\n[Test 2] Reopening Opportunity:');
  const reopenRes = await client.query(`
    select public.reopen_closed_opportunity($1, 'qualification', 'Customer requested follow-up') as result;
  `, [testOppId]);
  console.log('Reopen RPC result:', reopenRes.rows[0].result);

  const reopenedOpp = await client.query(`
    select stage, lost_reason, closed_at from public.opportunities where id = $1;
  `, [testOppId]);
  console.log('Reopened Opp state:', reopenedOpp.rows[0]);
  if (reopenedOpp.rows[0].stage !== 'qualification' || reopenedOpp.rows[0].lost_reason !== null) {
    throw new Error('Reopened opp did not clear lost_reason or set new stage');
  }

  const updatedHistory = await client.query(`
    select reopened_at, reopen_reason from public.crm_opportunity_loss_history where opportunity_id = $1;
  `, [testOppId]);
  console.log('Updated history:', updatedHistory.rows[0]);
  if (!updatedHistory.rows[0].reopened_at) throw new Error('History reopen timestamp was not set');

  // Test 3: opportunities_readable new columns with auth context
  console.log('\n[Test 3] opportunities_readable view columns (with auth context):');
  await client.query('begin');
  await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
  await client.query(`select set_config('role', 'authenticated', true)`);
  const viewRes = await client.query(`
    select id, stage, opportunity_age_days, days_in_stage, is_stalled, next_step
    from public.opportunities_readable
    where id = $1;
  `, [testOppId]);
  await client.query('commit');
  console.log('View row:', viewRes.rows[0]);
  if (!viewRes.rows[0] || viewRes.rows[0].opportunity_age_days === undefined || viewRes.rows[0].is_stalled === undefined) {
    throw new Error('opportunities_readable missing computed columns');
  }

  // Cleanup test opp
  await client.query('delete from public.opportunities where id = $1', [testOppId]);
  console.log('Cleaned up test opp');

  // Test 4: Duplicate Detection RPCs
  console.log('\n[Test 4] Duplicate Accounts Search:');
  const dupAccRes = await client.query(`
    select public.find_duplicate_accounts('Finlonexa', null, null) as dups;
  `);
  console.log('Find duplicate accounts result count:', dupAccRes.rows[0].dups.length);

  console.log('\n[Test 5] Duplicate Contacts Search:');
  const dupConRes = await client.query(`
    select public.find_duplicate_contacts('admin@finlonexa.com', null, null, null) as dups;
  `);
  console.log('Find duplicate contacts result count:', dupConRes.rows[0].dups.length);

  // Test 6: Sales Performance Leaderboard RPC
  console.log('\n[Test 6] Sales Performance Leaderboard RPC:');
  const lbRes = await client.query(`
    select public.get_sales_performance_leaderboard() as leaderboard;
  `);
  const lb = lbRes.rows[0].leaderboard;
  console.log('Leaderboard summary:', {
    totalTeamWon: lb.totalTeamWon,
    totalTeamQuota: lb.totalTeamQuota,
    overallAttainment: lb.overallAttainment,
    repsCount: lb.reps ? lb.reps.length : 0
  });

  // Test 7: Merge Accounts & Contacts
  console.log('\n[Test 7] Atomic Record Merging:');
  const acc1 = await client.query(`
    insert into public.accounts (name, website, contact_number)
    values ('Merge Test Master Inc', 'https://mergemaster.com', '1234567890')
    returning id;
  `);
  const acc2 = await client.query(`
    insert into public.accounts (name, website, contact_number)
    values ('Merge Test Victim Inc', 'https://mergevictim.com', '0987654321')
    returning id;
  `);
  const masterAccId = acc1.rows[0].id;
  const victimAccId = acc2.rows[0].id;

  // Add child contact to victim
  const childCon = await client.query(`
    insert into public.contacts (first_name, last_name, account_id)
    values ('Child', 'Contact', $1)
    returning id, account_id;
  `, [victimAccId]);

  // Execute Merge
  const mergeAccRes = await client.query(`
    select public.merge_accounts($1, $2, '{"website": "https://mergeddomain.com"}'::jsonb) as merge_result;
  `, [masterAccId, victimAccId]);
  console.log('Merge Accounts result:', mergeAccRes.rows[0].merge_result);

  // Verify child contact was repointed
  const repointedCon = await client.query(`
    select account_id from public.contacts where id = $1;
  `, [childCon.rows[0].id]);
  if (repointedCon.rows[0].account_id !== masterAccId) {
    throw new Error('Child contact was not repointed to master account');
  }

  // Verify victim account deleted
  const victimCheck = await client.query('select id from public.accounts where id = $1', [victimAccId]);
  if (victimCheck.rows.length > 0) throw new Error('Victim account was not deleted');

  // Verify master account updated with overrides
  const masterCheck = await client.query('select website from public.accounts where id = $1', [masterAccId]);
  if (masterCheck.rows[0].website !== 'https://mergeddomain.com') {
    throw new Error('Master account field overrides were not applied');
  }

  // Cleanup
  await client.query('delete from public.contacts where id = $1', [childCon.rows[0].id]);
  await client.query('delete from public.accounts where id = $1', [masterAccId]);
  console.log('Merge test completed and cleaned up successfully.');

  console.log('\n>>> ALL PHASE 05C DATABASE TESTS PASSED! <<<');
  await client.end();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
