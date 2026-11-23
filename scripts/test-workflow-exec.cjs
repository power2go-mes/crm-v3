const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const cs = env
  .split(/\r?\n/)
  .find((v) => /^DATABASE_URL\s*=/.test(v))
  .split('=')[1]
  .trim()
  .replace(/^['"]|['"]$/g, '');

const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });

async function testWorkflow() {
  await client.connect();

  const opp = await client.query('SELECT id, name, owner_id FROM public.opportunities LIMIT 1');
  const oppRow = opp.rows[0];
  console.log('Testing workflow event on opp:', oppRow.id);

  const res = await client.query(`
    SELECT public.process_crm_workflow_event(
      'opportunity_closed_won',
      'opportunity',
      $1,
      $2::jsonb
    ) as res
  `, [oppRow.id, JSON.stringify({ amount: '15000', owner_id: oppRow.owner_id })]);

  console.log('Workflow result:', res.rows[0].res);

  const logs = await client.query('SELECT * FROM public.crm_workflow_logs ORDER BY executed_at DESC LIMIT 1');
  console.log('Logged entry:', logs.rows[0]);

  await client.end();
}

testWorkflow().catch(console.error);
