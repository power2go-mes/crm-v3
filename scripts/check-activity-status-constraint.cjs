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

async function checkStatus() {
  await client.connect();

  const res = await client.query(`
    SELECT pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conname = 'activities_status_check'
  `);
  console.log('Constraint activities_status_check:', res.rows[0]?.pg_get_constraintdef);

  await client.end();
}

checkStatus().catch(console.error);
