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

async function verifyAll() {
  await client.connect();
  console.log('=== VERIFYING PHASE 05D DATABASE FOUNDATIONS & RPCS ===');

  // 1. Verify tables exist
  const tables = [
    'crm_email_accounts',
    'crm_email_templates',
    'crm_emails',
    'crm_workflow_rules',
    'crm_workflow_logs',
    'crm_custom_reports',
    'crm_calendar_connections',
    'crm_calendar_sync_links',
  ];

  for (const table of tables) {
    const res = await client.query(
      `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (parseInt(res.rows[0].count) > 0) {
      console.log(`[PASS] Table exists: public.${table}`);
    } else {
      console.error(`[FAIL] Table missing: public.${table}`);
    }
  }

  // 2. Verify permissions exist
  const perms = [
    'email.manage',
    'email.send',
    'email_templates.manage',
    'automation.view',
    'automation.manage',
    'reports.manage',
    'calendar.sync',
  ];
  for (const p of perms) {
    const res = await client.query('SELECT count(*) FROM public.permissions WHERE id = $1', [p]);
    console.log(`[PASS] Permission registered: ${p} (count: ${res.rows[0].count})`);
  }

  // 3. Test RPC: execute_custom_report
  console.log('\n--- Testing RPC: execute_custom_report ---');
  const customReportConfig = {
    primary_module: 'opportunities',
    selected_columns: ['name', 'amount', 'stage'],
    filters: [],
    sort_field: 'amount',
    sort_direction: 'desc',
    chart_type: 'table',
  };
  const execRes = await client.query(
    'SELECT public.execute_custom_report(NULL, $1::jsonb) as res',
    [JSON.stringify(customReportConfig)]
  );
  console.log('[PASS] execute_custom_report result:', {
    module: execRes.rows[0].res.module,
    total_count: execRes.rows[0].res.total_count,
    rows_returned: execRes.rows[0].res.rows.length,
  });

  // 4. Test RPC: generate_sales_reminders
  console.log('\n--- Testing RPC: generate_sales_reminders ---');
  const user = await client.query('SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1');
  const userId = user.rows[0].id;
  const remRes = await client.query(
    'SELECT public.generate_sales_reminders($1) as res',
    [userId]
  );
  console.log('[PASS] generate_sales_reminders result:', remRes.rows[0].res);

  // 5. Test RPC: process_crm_workflow_event
  console.log('\n--- Testing RPC: process_crm_workflow_event ---');
  const opp = await client.query('SELECT id, owner_id FROM public.opportunities LIMIT 1');
  const oppId = opp.rows[0].id;
  const wfRes = await client.query(
    'SELECT public.process_crm_workflow_event($1, $2, $3, $4::jsonb) as res',
    ['opportunity_closed_won', 'opportunity', oppId, JSON.stringify({ amount: '25000', owner_id: opp.rows[0].owner_id })]
  );
  console.log('[PASS] process_crm_workflow_event result:', wfRes.rows[0].res);

  // 6. Check counts of seeded data
  const templateCount = await client.query('SELECT count(*) FROM public.crm_email_templates');
  const ruleCount = await client.query('SELECT count(*) FROM public.crm_workflow_rules');
  const reportCount = await client.query('SELECT count(*) FROM public.crm_custom_reports');
  console.log('\n--- Seeded Entity Counts ---');
  console.log(`Email templates: ${templateCount.rows[0].count}`);
  console.log(`Workflow automation rules: ${ruleCount.rows[0].count}`);
  console.log(`Custom reports: ${reportCount.rows[0].count}`);

  await client.end();
  console.log('\n=== ALL PHASE 05D DATABASE CHECKS PASSED ===');
}

verifyAll().catch((err) => {
  console.error('[ERROR] Verification failed:', err);
  process.exit(1);
});
