process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8')
    .split(/\r?\n/)
    .find(v => /^DATABASE_URL\s*=/.test(v));
  if (!line) throw new Error('DATABASE_URL not found');
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Verifying Lead Assignment Rules & Routing Engine ---');

  try {
    await client.query("SET crm.allow_reassign = 'on'");
    // 1. Get test users
    const usersRes = await client.query('SELECT id, email FROM user_profiles LIMIT 2');
    if (usersRes.rows.length < 2) throw new Error('At least 2 user profiles required');
    const userA = usersRes.rows[0];
    const userB = usersRes.rows[1];
    console.log(`[PASS] Rep A: ${userA.email}, Rep B: ${userB.email}`);

    // 2. Insert test rule 1: Criteria based on Industry = 'Biotech'
    const rule1Res = await client.query(
      `INSERT INTO crm_lead_assignment_rules (
        name, description, assign_to_type, assigned_user_id, criteria, notify
      ) VALUES (
        'Biotech Route Rule', 'Assign all biotech leads to Rep A', 'user', $1,
        '[{"field": "industry", "operator": "equals", "value": "biotech"}]'::jsonb, true
      ) RETURNING id`,
      [userA.id]
    );
    const rule1Id = rule1Res.rows[0].id;
    console.log(`[PASS] Created criteria rule: ${rule1Id}`);

    // 3. Insert test rule 2: Round Robin rule for lead_source = 'event'
    const rule2Res = await client.query(
      `INSERT INTO crm_lead_assignment_rules (
        name, description, assign_to_type, round_robin_user_ids, criteria, notify
      ) VALUES (
        'Event Round-Robin', 'Rotate event leads between Rep A and Rep B', 'round_robin',
        ARRAY[$1, $2]::uuid[], '[{"field": "lead_source", "operator": "equals", "value": "event"}]'::jsonb, true
      ) RETURNING id`,
      [userA.id, userB.id]
    );
    const rule2Id = rule2Res.rows[0].id;
    console.log(`[PASS] Created round-robin rule: ${rule2Id}`);

    // 4. Create test lead 1 with industry = 'Biotech'
    const lead1Res = await client.query(
      `INSERT INTO leads (title, first_name, last_name, company_name, industry, lead_source, status, lead_owner_id, created_by_id)
       VALUES ('Mr', 'Biotech', 'Lead', 'BioGen Inc', 'Biotech', 'other', 'new', $1, $1)
       RETURNING id`,
      [userB.id] // Initially owned by B
    );
    const lead1Id = lead1Res.rows[0].id;

    // Evaluate rule on lead 1
    const eval1Res = await client.query('SELECT evaluate_and_assign_lead($1) as res', [lead1Id]);
    const eval1 = eval1Res.rows[0].res;
    if (!eval1.matched || eval1.assigned_to !== userA.id) {
      throw new Error(`Rule 1 evaluation failed: expected assign to userA, got ${JSON.stringify(eval1)}`);
    }
    console.log(`[PASS] Lead 1 matched Biotech rule and reassigned to Rep A (${eval1.assigned_to})`);

    // 5. Test Round Robin with two event leads
    const lead2Res = await client.query(
      `INSERT INTO leads (title, first_name, last_name, company_name, lead_source, status, lead_owner_id, created_by_id)
       VALUES ('Ms', 'Event1', 'Attendee', 'Event Co 1', 'event', 'new', $1, $1)
       RETURNING id`,
      [userA.id]
    );
    const lead2Id = lead2Res.rows[0].id;

    const lead3Res = await client.query(
      `INSERT INTO leads (title, first_name, last_name, company_name, lead_source, status, lead_owner_id, created_by_id)
       VALUES ('Ms', 'Event2', 'Attendee', 'Event Co 2', 'event', 'new', $1, $1)
       RETURNING id`,
      [userA.id]
    );
    const lead3Id = lead3Res.rows[0].id;

    const eval2 = (await client.query('SELECT evaluate_and_assign_lead($1) as res', [lead2Id])).rows[0].res;
    const eval3 = (await client.query('SELECT evaluate_and_assign_lead($1) as res', [lead3Id])).rows[0].res;

    console.log(`[PASS] Event Lead 1 assigned to: ${eval2.assigned_to}`);
    console.log(`[PASS] Event Lead 2 assigned to: ${eval3.assigned_to}`);

    if (eval2.assigned_to === eval3.assigned_to) {
      throw new Error('Round robin failed to alternate assignees');
    }
    console.log('[PASS] Round-robin sequential alternation verified');

    // Clean up
    await client.query('DELETE FROM leads WHERE id IN ($1, $2, $3)', [lead1Id, lead2Id, lead3Id]);
    await client.query('DELETE FROM crm_lead_assignment_rules WHERE id IN ($1, $2)', [rule1Id, rule2Id]);
    await client.query('DELETE FROM crm_notifications WHERE url IN ($1, $2, $3)', [
      `/leads/${lead1Id}`,
      `/leads/${lead2Id}`,
      `/leads/${lead3Id}`,
    ]);
    console.log('[PASS] Test fixtures cleaned up');

    console.log('\n>>> LEAD ASSIGNMENT & ROUTING SUITE: ALL TESTS PASSED (100%) <<<');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
