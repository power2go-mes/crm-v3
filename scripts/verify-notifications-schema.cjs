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

  try {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'crm_notifications'
      ORDER BY ordinal_position
    `);
    console.log('crm_notifications columns:');
    cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));

    const policies = await client.query(`
      SELECT policyname, cmd, roles
      FROM pg_policies
      WHERE tablename = 'crm_notifications'
    `);
    console.log('Policies:');
    policies.rows.forEach(p => console.log(`  ${p.policyname} (${p.cmd})`));

    const perms = await client.query(`
      SELECT id, module, action FROM permissions WHERE module = 'notifications'
    `);
    console.log('Permissions:');
    perms.rows.forEach(p => console.log(`  ${p.id} (${p.action})`));

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
