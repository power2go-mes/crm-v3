const fs=require('node:fs');
const {Client}=require('pg');
async function main(){
 const ref=process.argv[2];if(!/^[a-z0-9]{20}$/.test(ref||''))throw Error('Verified project required');
 const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>/^DATABASE_URL\s*=/.test(x));if(!line)throw Error('Missing configuration');
 const connectionString=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');const u=new URL(connectionString);
 if(u.hostname!==`db.${ref}.supabase.co`&&!(u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)===`postgres.${ref}`))throw Error('Wrong target');
 const c=new Client({connectionString,connectionTimeoutMillis:12000});try{
 await c.connect();const version='202611180101';const sql=fs.readFileSync('supabase/migrations/202611180101_shift_hours.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
 const receipt=await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);if(receipt.rows.length&&!receipt.rows[0].statements?.includes(sql))throw Error('Migration receipt conflict');
 await c.query("begin;set local lock_timeout='3s';set local statement_timeout='25s'");if(!receipt.rows.length)await c.query(sql);
 await c.query(fs.readFileSync('packages/crm-shared/tests/shift-hours-rollback.sql','utf8'));await c.query('rollback');console.log('PASS: Shift hours CRUD, same/different days, contained breaks, same-day intervals, atomic target rollback, cross-branch denial, 50-shift limit, bounded list and feature revocation; fixtures rolled back.');
 if(process.argv.includes('--apply')&&!process.argv.includes('--schema-owner'))throw Error('Exclusive migration ownership confirmation required before deployment');
 if(process.argv.includes('--apply')&&!receipt.rows.length){await c.query("begin;set local lock_timeout='3s';set local statement_timeout='25s'");await c.query(sql);await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'shift_hours',[sql]]);await c.query("notify pgrst,'reload schema'");await c.query('commit');console.log('Applied additive Shift Hours and atomic scoped services; no role grants or existing schedule changes.');}
 }catch(e){await c.query('rollback').catch(()=>{});console.error('Shift verification FAILED: '+(e.code||'ERROR')+' '+e.message);if(e.where)console.error(e.where.slice(-1200));if(e.detail)console.error(e.detail);process.exitCode=1;}finally{await c.end().catch(()=>{});}
}
main().catch(()=>{console.error('Shift configuration failure');process.exitCode=1;});
