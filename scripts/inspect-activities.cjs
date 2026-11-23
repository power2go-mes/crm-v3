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

  const tables = await client.query(`
    select table_name, column_name 
    from information_schema.columns 
    where table_name in ('tasks', 'calls', 'meetings', 'activities', 'notes', 'attachments', 'audit_logs')
      and table_schema = 'public'
    order by table_name, ordinal_position;
  `);

  console.log('--- ACTIVITIES / TASKS / NOTES COLUMNS ---');
  console.log(tables.rows);

  await client.end();
}

main().catch(console.error);
