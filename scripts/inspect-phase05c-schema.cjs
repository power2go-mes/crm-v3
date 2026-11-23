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

  const cols = await client.query(`
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_name in ('opportunities', 'accounts', 'contacts', 'opportunity_team_members')
      and table_schema = 'public'
    order by table_name, ordinal_position;
  `);
  console.log('--- COLUMNS ---');
  console.log(cols.rows);

  const viewCols = await client.query(`
    select column_name
    from information_schema.columns
    where table_name = 'opportunities_readable' and table_schema = 'public'
    order by ordinal_position;
  `);
  console.log('--- OPPORTUNITIES_READABLE COLUMNS ---');
  console.log(viewCols.rows.map(r => r.column_name));

  await client.end();
}

main().catch(console.error);
