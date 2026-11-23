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
  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name like '%lead%'
    order by table_name
  `);
  console.log('=== LEAD TABLES ===');
  console.table(tables.rows);

  const statuses = await client.query(`
    select * from public.lead_statuses order by order_index
  `);
  console.log('=== lead_statuses ROWS ===');
  console.table(statuses.rows);

  await client.end();
}

run();
