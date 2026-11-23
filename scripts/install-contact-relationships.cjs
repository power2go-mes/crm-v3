// Rollback-only PostgreSQL verification. Never applies migrations or commits fixtures.
const fs = require('node:fs');
const { Client } = require('pg');

async function main() {
  const expectedProject = process.argv[2];
  const installed = process.argv.includes('--installed');
  if (!/^[a-z0-9]{20}$/.test(expectedProject || '')) throw new Error('Supply the independently verified v3 project reference');
  const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find(value => /^DATABASE_URL\s*=/.test(value));
  if (!line) throw new Error('DATABASE_URL is not configured');
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const target = new URL(connectionString);
  if (target.hostname !== `db.${expectedProject}.supabase.co`
    && !(target.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(target.username) === `postgres.${expectedProject}`)) {
    throw new Error('Database target does not match the verified project');
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 12000 });
  try {
    await client.connect();
    await client.query("begin; set local lock_timeout='3s'; set local statement_timeout='20s'");
    const file='202611160004_contact_accounts.sql';
    const baseline=await client.query("select version from supabase_migrations.schema_migrations where version in ('202611160002','202611160004')");
    if(!baseline.rows.some(r=>r.version==='202611160002')||baseline.rows.some(r=>r.version==='202611160004')) throw Error('Unexpected baseline');
    let sql=fs.readFileSync('supabase/migrations/'+file,'utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
    await client.query(sql);
    const missing=await client.query('select count(*)::int as n from public.contacts c where c.account_id is not null and not exists(select 1 from public.contact_account_relationships r where r.contact_id=c.id and r.account_id=c.account_id)');
    if(missing.rows[0].n!==0)throw Error('Backfill mismatch');
    await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611160004','contact_accounts',[sql]]);
    await client.query("notify pgrst,'reload schema'");
    await client.query('commit');console.log('Contact relationship migration applied; exact legacy backfill verified.');
  } catch(e) {await client.query('rollback').catch(()=>{});console.error('Migration failed: '+(e.code||'VALIDATION'));process.exitCode=1;}
  finally {await client.end().catch(()=>{});}
}
main().catch(()=>{console.error('Configuration failure');process.exitCode=1;});
