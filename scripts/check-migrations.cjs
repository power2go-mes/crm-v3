process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function check() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8').split(/\r?\n/).find(v => /^DATABASE_URL\s*=/.test(v));
  const conn = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const res = await c.query('select version, name from supabase_migrations.schema_migrations order by version desc limit 15');
  console.log(res.rows);

  await c.end();
}

check().catch(console.error);
