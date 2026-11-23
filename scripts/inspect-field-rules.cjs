process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8').split(/\r?\n/).find(v => /^DATABASE_URL\s*=/.test(v));
  const conn = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const defs = await c.query('select module, key, label, type, is_custom from public.crm_field_definitions order by module, key');
  console.log('CRM Field Definitions Count:', defs.rows.length);
  console.table(defs.rows);
  const rules = await c.query('select r.role_id, d.module, d.key, r.visible, r.editable from public.crm_field_rules r join public.crm_field_definitions d on d.id = r.definition_id');
  console.log('CRM Field Rules Count:', rules.rows.length);
  console.table(rules.rows);
  await c.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
