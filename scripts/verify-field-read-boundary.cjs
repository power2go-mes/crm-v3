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
    await client.query(fs.readFileSync('packages/crm-shared/tests/leads-security-rollback.sql','utf8'));
    await client.query(fs.readFileSync('packages/crm-shared/tests/module-contracts-rollback.sql','utf8'));
    const sql=fs.readFileSync('docs/staged-sql/202611170003_field_read_boundary.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
    await client.query(sql);
    await client.query(fs.readFileSync('packages/crm-shared/tests/field-read-boundary-rollback.sql','utf8'));
    await client.query('rollback');console.log('Field read boundary/raw column denial/masking/RLS assertions PASS; ALL candidate DDL and fixtures rolled back');
  }catch(e){await client.query('rollback').catch(()=>{});console.error('Read boundary failed: '+(e.code||'VALIDATION'));if(['P0004','42501'].includes(e.code))console.error(e.message);process.exitCode=1;}finally{await client.end().catch(()=>{});}
}
main().catch(()=>{console.error('Configuration failure');process.exitCode=1;});
