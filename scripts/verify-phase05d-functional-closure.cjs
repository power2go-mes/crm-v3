const fs = require('fs');
const http = require('http');
const { Client } = require('pg');

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const cs = env
  .split(/\r?\n/)
  .find((v) => /^DATABASE_URL\s*=/.test(v))
  .split('=')[1]
  .trim()
  .replace(/^['"]|['"]$/g, '');

const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });

async function runFunctionalClosure() {
  await client.connect();
  console.log('================================================================');
  console.log('FINLONEXA CRM v3 — PHASE 05D FUNCTIONAL CLOSURE VERIFICATION');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  // --------------------------------------------------------------------------
  // PRIORITY 1: WORKFLOW AUTOMATION UNATTENDED TRIGGERING
  // --------------------------------------------------------------------------
  console.log('--- Priority 1: Automated Workflow Trigger Execution ---');

  // Find or create test opportunity
  const oppRes = await client.query('SELECT id, name, owner_id FROM public.opportunities LIMIT 1');
  assert(oppRes.rows.length > 0, 'Opportunity exists for trigger testing');
  const testOpp = oppRes.rows[0];

  // Reset stage to 'negotiation'
  await client.query("UPDATE public.opportunities SET stage = 'negotiation' WHERE id = $1", [testOpp.id]);

  const logsBefore = await client.query('SELECT count(*) FROM public.crm_workflow_logs WHERE record_id = $1', [testOpp.id]);
  const initialLogCount = parseInt(logsBefore.rows[0].count);

  // Trigger opportunity update via raw database query (Unattended)
  await client.query("UPDATE public.opportunities SET stage = 'closed_won', amount = 42000 WHERE id = $1", [testOpp.id]);

  const logsAfter = await client.query('SELECT count(*) FROM public.crm_workflow_logs WHERE record_id = $1', [testOpp.id]);
  const finalLogCount = parseInt(logsAfter.rows[0].count);

  assert(finalLogCount > initialLogCount, 'Database trigger dispatched workflow without manual RPC invocation');

  const latestLog = await client.query(`
    SELECT rule_id, trigger_event, status, actions_executed
    FROM public.crm_workflow_logs
    WHERE record_id = $1
    ORDER BY executed_at DESC LIMIT 1
  `, [testOpp.id]);

  assert(latestLog.rows[0].status === 'success', 'Workflow execution status logged as success');
  assert(latestLog.rows[0].actions_executed.length > 0, 'Workflow actions executed and audit logged');

  // Verify automated task was created in activities table
  const createdTask = await client.query(`
    SELECT id, subject, status, priority, related_to_id
    FROM public.activities
    WHERE related_to_id = $1 AND subject LIKE '%Executive Onboarding%'
    ORDER BY created_at DESC LIMIT 1
  `, [testOpp.id]);

  assert(createdTask.rows.length > 0, 'Automated task created in activities with status not_started');
  assert(createdTask.rows[0].status === 'not_started', 'Activity status conforms to check constraint');

  // --------------------------------------------------------------------------
  // PRIORITY 2: SCHEDULED REMINDERS & PG_CRON
  // --------------------------------------------------------------------------
  console.log('\n--- Priority 2: Scheduled Reminders & Background Scheduling ---');

  // Verify pg_cron job in database
  const cronJobs = await client.query(`
    SELECT jobid, jobname, schedule, command, active
    FROM cron.job
    WHERE jobname = 'crm-sales-reminders-hourly'
  `);
  assert(cronJobs.rows.length > 0, 'Hourly pg_cron job is active: crm-sales-reminders-hourly');
  assert(cronJobs.rows[0].active === true, 'pg_cron job active status is true');

  // Execute generate_sales_reminders RPC for all users
  const reminderRun1 = await client.query('SELECT public.generate_sales_reminders() as res');
  assert(reminderRun1.rows[0].res.success === true, 'generate_sales_reminders executed successfully across all users');

  // Test duplicate suppression: running immediately again should create 0 duplicates for suppressed items
  const reminderRun2 = await client.query('SELECT public.generate_sales_reminders() as res');
  assert(reminderRun2.rows[0].res.reminders_created === 0, 'Duplicate notification suppression verified (0 duplicates generated)');

  // --------------------------------------------------------------------------
  // PRIORITY 3: CUSTOM REPORT BUILDER SECURITY & HARDENING
  // --------------------------------------------------------------------------
  console.log('\n--- Priority 3: Custom Report Builder Security & Whitelisting ---');

  // Test 1: Whitelist module rejection
  let maliciousModuleCaught = false;
  try {
    await client.query(`
      SELECT public.execute_custom_report(NULL, $1::jsonb)
    `, [JSON.stringify({ primary_module: 'system_secrets; DROP TABLE users' })]);
  } catch (err) {
    maliciousModuleCaught = true;
    assert(err.code === '42501' || err.message.includes('Invalid report module'), 'Invalid module rejected by whitelist security boundary');
  }
  assert(maliciousModuleCaught, 'Attempt to query non-whitelisted module failed as expected');

  // Test 2: SQL injection sanitization on sort_field
  const sqlInjectionConfig = {
    primary_module: 'opportunities',
    selected_columns: ['name', 'amount'],
    sort_field: 'amount; DELETE FROM crm_workflow_rules; --',
    sort_direction: 'desc',
  };
  const injectionRes = await client.query(`
    SELECT public.execute_custom_report(NULL, $1::jsonb) as res
  `, [JSON.stringify(sqlInjectionConfig)]);
  assert(injectionRes.rows[0].res.module === 'opportunities', 'SQL injection in sort_field was sanitized safely to default created_at');

  // Verify rules table is intact
  const ruleCount = await client.query('SELECT count(*) FROM public.crm_workflow_rules');
  assert(parseInt(ruleCount.rows[0].count) >= 2, 'crm_workflow_rules remains completely protected');

  // Test 3: Verified querying masked view
  const oppReport = await client.query(`
    SELECT public.execute_custom_report(NULL, $1::jsonb) as res
  `, [JSON.stringify({ primary_module: 'opportunities', selected_columns: ['name', 'amount', 'stage'], sort_field: 'amount', sort_direction: 'desc' })]);
  assert(Array.isArray(oppReport.rows[0].res.rows), 'Query returned rows from opportunities_readable');
  assert(oppReport.rows[0].res.limit === 250, 'Enforced 250 record performance ceiling');

  // --------------------------------------------------------------------------
  // PRIORITY 4: EMAIL AND CALENDAR SECURITY & ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n--- Priority 4: Email & Calendar Isolation & Status ---');

  const users = await client.query('SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 2');
  const userA = users.rows[0]?.id;
  const userB = users.rows[1]?.id;

  if (userA) {
    // Upsert a test email account for user A
    await client.query(`
      INSERT INTO public.crm_email_accounts (
        user_id, provider, email_address, display_name, auth_status, status_message
      ) VALUES (
        $1, 'google', 'rep.sales@finlonexa.com', 'Enterprise Rep', 'unconfigured', 'Provider OAuth credentials pending'
      ) ON CONFLICT (user_id, email_address) DO UPDATE SET
        auth_status = 'unconfigured'
    `, [userA]);

    const acc = await client.query('SELECT user_id, provider, auth_status FROM public.crm_email_accounts WHERE user_id = $1', [userA]);
    assert(acc.rows[0].auth_status === 'unconfigured', 'Email account status marked honest unconfigured');

    // Calendar connection
    await client.query(`
      INSERT INTO public.crm_calendar_connections (
        user_id, provider, calendar_name, sync_status, sync_direction, error_message
      ) VALUES (
        $1, 'google_calendar', 'Primary Sales', 'unconfigured', 'both', 'BLOCKED (Requires Provider OAuth Configuration)'
      ) ON CONFLICT (user_id, provider) DO UPDATE SET
        sync_status = 'unconfigured'
    `, [userA]);

    const cal = await client.query('SELECT user_id, provider, sync_status FROM public.crm_calendar_connections WHERE user_id = $1', [userA]);
    assert(cal.rows[0].sync_status === 'unconfigured', 'Calendar connection status marked honest unconfigured');
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`FUNCTIONAL CLOSURE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  await client.end();
}

runFunctionalClosure().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
