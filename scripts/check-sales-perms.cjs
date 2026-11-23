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

  const perms = await client.query(`
    select id, module, action from public.permissions 
    where id in ('sales_performance.view', 'sales_targets.view', 'sales_targets.manage', 'data_quality.manage', 'settings.view', 'settings.update')
       or module in ('sales_performance', 'settings', 'sales_targets', 'data_quality');
  `);
  console.log('Matches:', perms.rows);
  await client.end();
}

main().catch(console.error);
