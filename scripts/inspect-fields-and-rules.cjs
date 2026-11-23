process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8');
const line = envContent.split(/\r?\n/).find(v => /^DATABASE_URL\s*=/.test(v));
const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL');

  const fields = await client.query('SELECT id, module, key, label, is_custom, archived FROM public.crm_field_definitions ORDER BY is_custom, module, key');
  console.log('crm_field_definitions count:', fields.rows.length);
  fields.rows.forEach(f => {
    console.log(`[${f.is_custom ? 'CUSTOM' : 'BUILT-IN'}] ${f.module}.${f.key} (${f.label}) - id: ${f.id}`);
  });

  const rules = await client.query('SELECT fr.*, d.module, d.key FROM public.crm_field_rules fr JOIN public.crm_field_definitions d ON d.id = fr.definition_id');
  console.log('crm_field_rules count:', rules.rows.length);
  rules.rows.forEach(r => {
    console.log(`  Rule: ${r.module}.${r.key} for role ${r.role_id}: visible=${r.visible}, editable=${r.editable}`);
  });

  await client.end();
}

main().catch(console.error);
