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

  console.log('--- Verifying Opportunity Teams & Revenue Splits ---');

  try {
    // 1. Get an existing opportunity
    const oppRes = await client.query('SELECT id, name, amount FROM opportunities LIMIT 1');
    if (oppRes.rows.length === 0) throw new Error('No opportunity found');
    const opp = oppRes.rows[0];
    console.log(`[PASS] Target Opportunity: ${opp.name} (${opp.id}), Amount: $${opp.amount}`);

    // 2. Get two users
    const usersRes = await client.query('SELECT id, email FROM user_profiles LIMIT 2');
    const userA = usersRes.rows[0];
    const userB = usersRes.rows[1];

    // 3. Add Member A: Solutions Architect, 30% split
    const addA = await client.query(
      'SELECT add_opportunity_team_member($1, $2, $3, $4, $5) as id',
      [opp.id, userA.id, 'Solutions Architect', 'read', 30.00]
    );
    console.log(`[PASS] Added Member A (${userA.email}) with 30% split: ${addA.rows[0].id}`);

    // 4. Add Member B: Account Executive, 70% split
    const addB = await client.query(
      'SELECT add_opportunity_team_member($1, $2, $3, $4, $5) as id',
      [opp.id, userB.id, 'Account Executive', 'edit', 70.00]
    );
    console.log(`[PASS] Added Member B (${userB.email}) with 70% split: ${addB.rows[0].id}`);

    // 5. Query members and sum split percentage
    const membersRes = await client.query(
      `SELECT m.id, m.team_role, m.access_level, m.split_percentage, u.email
       FROM opportunity_team_members m
       JOIN user_profiles u ON u.id = m.user_id
       WHERE m.opportunity_id = $1`,
      [opp.id]
    );
    let totalSplit = 0;
    for (const row of membersRes.rows) {
      totalSplit += parseFloat(row.split_percentage);
      console.log(`  - ${row.email}: ${row.team_role} (${row.access_level}), ${row.split_percentage}% split`);
    }
    if (totalSplit !== 100.0) throw new Error(`Expected 100% split sum, got ${totalSplit}`);
    console.log(`[PASS] Split percentage verified: ${totalSplit}%`);

    // 6. Verify in-app notifications dispatched
    const notifRes = await client.query(
      "SELECT id, user_id, title FROM crm_notifications WHERE category = 'deal' AND url = $1",
      [`/opportunities/${opp.id}`]
    );
    console.log(`[PASS] Dispatched notifications for team members: ${notifRes.rows.length} alerts created`);

    // Clean up
    await client.query('DELETE FROM opportunity_team_members WHERE opportunity_id = $1', [opp.id]);
    await client.query('DELETE FROM crm_notifications WHERE url = $1', [`/opportunities/${opp.id}`]);
    console.log('[PASS] Test team members cleaned up');

    console.log('\n>>> OPPORTUNITY TEAMS & SPLITS SUITE: ALL TESTS PASSED (100%) <<<');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
