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

async function seedWorkflows() {
  await client.connect();

  const user = await client.query(`SELECT id FROM auth.users WHERE email = 'test.superadmin@finlonexa.test'`);
  const adminId = user.rows[0].id;

  const rules = [
    {
      name: 'Executive Follow-Up on Closed Won Deals',
      description: 'Automatically schedules high-priority onboarding task upon winning deals',
      trigger_event: 'opportunity_closed_won',
      conditions: JSON.stringify([{ field: 'amount', operator: 'greater_than', value: '5000' }]),
      actions: JSON.stringify([
        { type: 'create_task', title: 'Schedule Executive Onboarding & Customer Kickoff', priority: 'high' },
        { type: 'create_notification', title: 'Deal Won Alert', message: 'Congratulations! Customer kickoff task generated.' }
      ]),
      is_active: true,
      priority: 1
    },
    {
      name: 'Stalled Opportunity Re-Engagement Task',
      description: 'Alerts sales rep when deal has remained in stage over 14 days without movement',
      trigger_event: 'opportunity_stage_changed',
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: 'create_notification', title: 'Deal Progression Alert', message: 'Stage advanced. Please log next step.' }
      ]),
      is_active: true,
      priority: 2
    }
  ];

  for (const r of rules) {
    await client.query(`
      INSERT INTO public.crm_workflow_rules (name, description, trigger_event, conditions, actions, is_active, priority, created_by_id)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
      ON CONFLICT DO NOTHING
    `, [r.name, r.description, r.trigger_event, r.conditions, r.actions, r.is_active, r.priority, adminId]);
  }

  console.log('Default workflow rules seeded successfully!');
  await client.end();
}

seedWorkflows().catch(console.error);
