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
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'lead_history'
    ORDER BY ordinal_position
  `);
  console.log('lead_history columns:', res.rows);

  const intents = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'lead_attachment_removal_intents'
    ORDER BY ordinal_position
  `);
  console.log('lead_attachment_removal_intents columns:', intents.rows);

  await client.end();
}

run().catch(console.error);
