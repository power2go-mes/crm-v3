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
    await client.query('set local transaction_read_only=on');
    console.log(JSON.stringify({receipt:(await client.query("select version,name,statements is not null as has_statements from supabase_migrations.schema_migrations where version='202611170004'")).rows,memberColumns:(await client.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='campaign_members' order by ordinal_position")).rows,memberFunctions:(await client.query("select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and (proname like '%campaign%member%' or proname='guard_campaign_member')")).rows}));await client.query('rollback');
  }catch(e){await client.query('rollback').catch(()=>{});console.error('Read-only receipt inspection failed: '+(e.code||'ERROR'));process.exitCode=1;}finally{await client.end().catch(()=>{});}
}
main().catch(()=>{console.error('Configuration failure');process.exitCode=1;});
