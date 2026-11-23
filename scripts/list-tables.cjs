process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8').split(/\r?\n/).find(v => /^DATABASE_URL\s*=/.test(v));
  const conn = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const tables = await c.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1");
  console.log('Tables in public schema (total ' + tables.rows.length + '):');
  console.log(tables.rows.map(r => r.table_name).join(', '));
  await c.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
