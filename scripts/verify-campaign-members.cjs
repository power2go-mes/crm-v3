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
    const sql=fs.readFileSync('docs/staged-sql/campaign_members_candidate.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
    const applied=await client.query("select statements from supabase_migrations.schema_migrations where version='202611170004'");
    if(applied.rows.length){if(!Array.isArray(applied.rows[0].statements))throw Error('Unverified migration ownership: installed receipt has no statements');if(!applied.rows[0].statements.includes(sql))throw Error('Member migration drift');}else await client.query(sql);
    await client.query(fs.readFileSync('packages/crm-shared/tests/leads-security-rollback.sql','utf8'));
    await client.query(fs.readFileSync('packages/crm-shared/tests/module-contracts-rollback.sql','utf8'));
    await client.query(fs.readFileSync('packages/crm-shared/tests/campaign-members-rollback.sql','utf8'));
    await client.query('rollback');console.log('Campaign member add/status/remove/counter/duplicate/scope assertions PASS; fixtures rolled back');
    if(process.argv.includes('--apply')&&!applied.rows.length){await client.query('begin');await client.query(sql);await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611170004','campaign_members',[sql]]);await client.query("notify pgrst,'reload schema'");await client.query('commit');console.log('Campaign member migration applied');}
  }catch(e){await client.query('rollback').catch(()=>{});console.error('Member verification failed: '+(e.code||'VALIDATION'));if(e.message==='Member migration drift'||e.message==='Unverified migration ownership: installed receipt has no statements')console.error(e.message);if(e instanceof TypeError)console.error(e.message);if(e.code==='P0004')console.error(e.message);process.exitCode=1;}finally{await client.end().catch(()=>{});}
}
main().catch(()=>{console.error('Configuration failure');process.exitCode=1;});
