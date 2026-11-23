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

async function testCron() {
  await client.connect();

  try {
    const jobs = await client.query('SELECT * FROM cron.job');
    console.log('Current cron jobs in cron.job:', jobs.rows);
  } catch (err) {
    console.log('cron.job query error:', err.message);
  }

  await client.end();
}

testCron().catch(console.error);
