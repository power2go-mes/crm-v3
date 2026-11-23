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
  console.log('Applying migration 20261123230000_lead_attachment_admin_handoff.sql...');

  const sql = fs.readFileSync('supabase/migrations/20261123230000_lead_attachment_admin_handoff.sql', 'utf8');
  await client.query(sql);

  console.log('Migration applied successfully!');
  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
