const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const cs = env
  .split(/\r?\n/)
  .find((v) => /^DATABASE_URL\s*=/.test(v))
  .split('=')[1]
  .trim()
  .replace(/^['"]|['"]$/g, '');

const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  console.log('--- Columns for crm_notifications ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'crm_notifications'
    ORDER BY ordinal_position
  `);
  console.log(cols.rows.map(c => `${c.column_name} (${c.data_type})`));

  console.log('\n--- RLS on crm_notifications ---');
  const rls = await client.query(`
    SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck
    FROM pg_policy
    WHERE polrelid = 'public.crm_notifications'::regclass
  `);
  console.log(rls.rows.map(r => ({ name: r.polname, cmd: r.polcmd })));

  console.log('\n--- Current row count in crm_notifications ---');
  const cnt = await client.query('SELECT count(*) FROM public.crm_notifications');
  console.log('Total notifications:', cnt.rows[0].count);

  await client.end();
}

main().catch(e => { console.error(e); client.end(); });
