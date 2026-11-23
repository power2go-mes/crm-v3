// Focused synthetic verification. No fixture commits; only new reviewed DDL may install.
const fs = require('node:fs');
const { Client } = require('pg');
async function main() {
 const ref=process.argv[2];
 if(!/^[a-z0-9]{20}$/.test(ref||'')) throw Error('Verified project reference required');
 const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>/^DATABASE_URL\s*=/.test(x));
 if(!line)throw Error('Database configuration unavailable');
 const connectionString=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');
 const target=new URL(connectionString);
 if(target.hostname!==`db.${ref}.supabase.co` && !(target.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(target.username)===`postgres.${ref}`))throw Error('Wrong database target');
 const c=new Client({connectionString,connectionTimeoutMillis:12000});
 try {
  await c.connect();
  const sql=fs.readFileSync('supabase/migrations/202611170012_departments.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
  const receipt=await c.query("select statements from supabase_migrations.schema_migrations where version='202611170012'");
  if(receipt.rows.length&&!receipt.rows[0].statements?.includes(sql))throw Error('Migration receipt conflict');
  await c.query("begin; set local lock_timeout='3s'; set local statement_timeout='25s'");
  if(!receipt.rows.length) await c.query(sql);
  const requirementsOnly=process.argv.includes('--requirements-only');
  await c.query(fs.readFileSync(`packages/crm-shared/tests/${requirementsOnly?'field-requirements':'departments'}-rollback.sql`,'utf8'));
  await c.query('rollback');console.log(requirementsOnly ? 'PASS: Field Requirement create/edit/delete, default preservation, nonrelaxable constraint, unauthorized/revoked writes; fixtures rolled back.' : 'PASS: Department create/edit, validation, duplicate, actor, permission denial/revocation, raw writes, recovery and dependency checks; fixtures rolled back.');
  if(process.argv.includes('--apply')&&!requirementsOnly&&!receipt.rows.length){
   await c.query("begin; set local lock_timeout='3s'; set local statement_timeout='25s'");
   await c.query(sql);
   await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611170012','departments',[sql]]);
   await c.query("notify pgrst,'reload schema'");await c.query('commit');console.log('Applied additive Departments migration; no role grants or legacy user rewrites.');
  }
 } catch(e){ await c.query('rollback').catch(()=>{});console.error('Department verification FAILED: '+(e.code||'ERROR')+' '+e.message);process.exitCode=1; }
 finally {await c.end().catch(()=>{});}
}
main().catch(()=>{console.error('Department configuration failure');process.exitCode=1;});
