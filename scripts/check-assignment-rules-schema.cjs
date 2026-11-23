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
    select column_name, data_type, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_lead_assignment_rules'
    order by ordinal_position
  `);
  console.log('=== crm_lead_assignment_rules COLUMNS ===');
  console.table(res.rows);

  const rules = await client.query(`select * from public.crm_lead_assignment_rules`);
  console.log('=== CURRENT RULES ===');
  console.table(rules.rows);

  await client.end();
}

run();
