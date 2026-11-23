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

async function testTrigger() {
  await client.connect();
  console.log('=== TESTING UNATTENDED DATABASE TRIGGER WORKFLOW EXECUTION ===');

  // 1. Get an existing opportunity
  const opp = await client.query('SELECT id, name, stage, amount, owner_id FROM public.opportunities WHERE stage <> \'closed_won\' LIMIT 1');
  if (opp.rows.length === 0) {
    console.log('No non-closed_won opp found, picking first opp');
    const anyOpp = await client.query('SELECT id, name, stage, amount, owner_id FROM public.opportunities LIMIT 1');
    await client.query("UPDATE public.opportunities SET stage = 'negotiation' WHERE id = $1", [anyOpp.rows[0].id]);
    opp.rows = [anyOpp.rows[0]];
  }
  const targetOpp = opp.rows[0];
  console.log('Target Opportunity:', { id: targetOpp.id, name: targetOpp.name, currentStage: targetOpp.stage });

  const beforeLogs = await client.query('SELECT count(*) FROM public.crm_workflow_logs WHERE record_id = $1', [targetOpp.id]);
  const beforeTasks = await client.query('SELECT count(*) FROM public.activities WHERE related_to_id = $1', [targetOpp.id]);
  console.log('Before update - logs count:', beforeLogs.rows[0].count, 'tasks count:', beforeTasks.rows[0].count);

  // 2. Perform a standard UPDATE on the opportunity table (simulating user or API saving record)
  // NO MANUAL RPC CALL!
  console.log("Executing SQL: UPDATE public.opportunities SET stage = 'closed_won', amount = 35000 WHERE id = $1");
  await client.query("UPDATE public.opportunities SET stage = 'closed_won', amount = 35000 WHERE id = $1", [targetOpp.id]);

  // 3. Verify workflow log entry created automatically by trigger
  const afterLogs = await client.query(`
    SELECT id, rule_id, record_id, trigger_event, status, actions_executed, executed_at 
    FROM public.crm_workflow_logs 
    WHERE record_id = $1 
    ORDER BY executed_at DESC 
    LIMIT 2
  `, [targetOpp.id]);

  console.log('\n--- Automatic Workflow Logs Dispatched by Trigger ---');
  console.log(afterLogs.rows);

  // 4. Verify automated task created in activities
  const afterTasks = await client.query(`
    SELECT id, subject, activity_type, status, priority, related_to_id, created_at
    FROM public.activities
    WHERE related_to_id = $1 AND subject LIKE '%Executive Onboarding%'
    ORDER BY created_at DESC
    LIMIT 1
  `, [targetOpp.id]);

  console.log('\n--- Automated Activity Task Created ---');
  console.log(afterTasks.rows);

  if (afterLogs.rows.length > 0 && afterTasks.rows.length > 0) {
    console.log('\n[PASS] Verified: Unattended database trigger successfully executed workflow automation rules without manual RPC invocation!');
  } else {
    console.error('\n[FAIL] Workflow was not dispatched automatically by database trigger.');
    process.exit(1);
  }

  await client.end();
}

testTrigger().catch((e) => {
  console.error(e);
  process.exit(1);
});
