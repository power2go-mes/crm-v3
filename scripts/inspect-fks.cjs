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

  const fks = await client.query(`
    select
      tc.table_schema, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    from information_schema.table_constraints AS tc 
    join information_schema.key_column_usage AS kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage AS ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' 
      and ccu.table_name in ('accounts', 'contacts', 'opportunities')
    order by ccu.table_name, tc.table_name;
  `);

  console.log('--- FOREIGN KEYS POINTING TO ACCOUNTS / CONTACTS / OPPORTUNITIES ---');
  console.log(fks.rows);

  await client.end();
}

main().catch(console.error);
