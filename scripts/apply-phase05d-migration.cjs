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

async function main() {
  await client.connect();

  console.log('Reading migration file 202611230002_phase05d_productivity_automation.sql...');
  const sql = fs.readFileSync('supabase/migrations/202611230002_phase05d_productivity_automation.sql', 'utf8');

  console.log('Applying migration...');
  await client.query(sql);
  console.log('Migration applied successfully!');

  // Verify created tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN (
        'crm_email_accounts', 'crm_email_templates', 'crm_emails',
        'crm_workflow_rules', 'crm_workflow_logs',
        'crm_custom_reports', 'crm_calendar_connections', 'crm_calendar_sync_links'
      )
    ORDER BY table_name
  `);
  console.log('\nVerified Phase 05D Tables:', tables.rows.map(r => r.table_name));

  // Verify permissions
  const perms = await client.query(`
    SELECT id, module, action FROM public.permissions
    WHERE id IN ('email.manage', 'email.send', 'email_templates.manage', 'automation.view', 'automation.manage', 'reports.manage', 'calendar.sync')
    ORDER BY id
  `);
  console.log('\nVerified Phase 05D Permissions (count ' + perms.rows.length + '):', perms.rows.map(r => r.id));

  // Test generate_sales_reminders RPC
  const user = await client.query(`
    SELECT id FROM auth.users WHERE email = 'test.superadmin@finlonexa.test'
  `);
  const userId = user.rows[0].id;
  console.log('\nTesting generate_sales_reminders RPC for user ' + userId);
  const remindersRes = await client.query(`
    SELECT public.generate_sales_reminders($1) as res
  `, [userId]);
  console.log('Reminders result:', remindersRes.rows[0].res);

  // Test execute_custom_report RPC with authenticated user context
  console.log('\nTesting execute_custom_report RPC for accounts as user ' + userId);
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE authenticated`);
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);

  const reportRes = await client.query(`
    SELECT public.execute_custom_report(
      p_report_id := NULL,
      p_config := '{"primary_module": "accounts", "sort_field": "created_at", "sort_direction": "desc"}'::jsonb
    ) as res
  `);
  console.log('Report result total count:', reportRes.rows[0].res?.total_count, 'rows count:', reportRes.rows[0].res?.rows?.length);
  await client.query('ROLLBACK');

  await client.end();
}

main().catch(e => {
  console.error('Error applying migration:', e);
  client.end();
  process.exit(1);
});
