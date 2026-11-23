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
    select column_name, data_type, character_maximum_length, udt_name
    from information_schema.columns
    where table_name = 'opportunities_readable' and table_schema = 'public'
    order by ordinal_position;
  `);
  console.log(r.rows);
  await client.end();
}

main().catch(console.error);
