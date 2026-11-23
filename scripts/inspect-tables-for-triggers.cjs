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

async function inspect() {
  await client.connect();

  const tables = ['opportunities', 'crm_quotas', 'crm_quotes', 'quotes', 'activities'];
  for (const t of tables) {
    const res = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t]
    );
    if (res.rows.length > 0) {
      console.log(`\nTable ${t}:`);
      console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    }
  }

  // Also check if pg_cron is available
  const ext = await client.query(`SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron'`);
  console.log('\npg_cron extension:', ext.rows);

  await client.end();
}

inspect().catch(console.error);
