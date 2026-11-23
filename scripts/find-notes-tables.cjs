process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8')
    .split(/\r?\n/)
    .find(v => /^DATABASE_URL\s*=/.test(v));
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const r = await client.query(`
    select table_name 
    from information_schema.tables 
    where table_schema='public' 
      and (table_name like '%note%' or table_name like '%attach%' or table_name like '%quote%')
    order by table_name;
  `);
  console.log('Tables found:', r.rows.map(x => x.table_name));
  await client.end();
}

main().catch(console.error);
