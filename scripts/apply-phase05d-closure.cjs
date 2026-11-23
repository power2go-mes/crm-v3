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
  console.log('Applying migration 202611230003_phase05d_operational_closure.sql...');

  const sql = fs.readFileSync('supabase/migrations/202611230003_phase05d_operational_closure.sql', 'utf8');
  await client.query(sql);

  console.log('Migration applied successfully!');

  // Check scheduled pg_cron job
  const jobs = await client.query('SELECT jobid, jobname, schedule, command, active FROM cron.job');
  console.log('Active pg_cron jobs:', jobs.rows);

  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
