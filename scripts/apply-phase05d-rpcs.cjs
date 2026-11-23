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

async function run() {
  await client.connect();
  console.log('Connected to DB');

  const sql = fs.readFileSync('supabase/migrations/202611230002_phase05d_productivity_automation.sql', 'utf8');
  // Execute from line with process_crm_workflow_event to line 568
  await client.query(sql);
  console.log('Migration executed successfully');
  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
