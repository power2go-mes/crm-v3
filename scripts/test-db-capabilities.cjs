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

async function testCapabilities() {
  await client.connect();

  try {
    const res = await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
    console.log('[pg_cron] Successfully created or already exists');
  } catch (err) {
    console.log('[pg_cron] Not available via current connection:', err.message);
  }

  // Check current triggers on opportunities
  const trg = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'opportunities'
  `);
  console.log('\nExisting triggers on opportunities:', trg.rows.map(r => r.trigger_name));

  await client.end();
}

testCapabilities().catch(console.error);
