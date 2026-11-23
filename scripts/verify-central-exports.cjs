const fs=require('node:fs');const {Client}=require('pg');
async function main(){
 const ref=process.argv[2];if(!/^[a-z0-9]{20}$/.test(ref||''))throw Error('Verified project reference required');
 const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>/^DATABASE_URL\s*=/.test(x));if(!line)throw Error('Missing database configuration');
 const connectionString=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');const target=new URL(connectionString);
 if(target.hostname!==`db.${ref}.supabase.co`&&!(target.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(target.username)===`postgres.${ref}`))throw Error('Wrong database target');
 const c=new Client({connectionString,connectionTimeoutMillis:12000});
 try{await c.connect();const version='202611180001';const sql=fs.readFileSync('supabase/migrations/202611180001_central_export_permissions.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
 const receipt=await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);
 if(receipt.rows.length&&!receipt.rows[0].statements?.includes(sql))throw Error('Migration receipt mismatch');
 await c.query("begin;set local lock_timeout='3s';set local statement_timeout='30s'");if(!receipt.rows.length)await c.query(sql);
 await c.query(fs.readFileSync('packages/crm-shared/tests/central-exports-rollback.sql','utf8'));
 await c.query('rollback');console.log('PASS: five-module scoped reads, foreign-owner denial, explicit/revoked export features and hidden/readonly metadata; synthetic fixtures rolled back.');
 if(process.argv.includes('--apply')&&!receipt.rows.length){await c.query("begin;set local lock_timeout='3s';set local statement_timeout='20s'");await c.query(sql);await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'central_export_permissions',[sql]]);await c.query("notify pgrst,'reload schema'");await c.query('commit');console.log('Applied permission catalog entries only; no automatic grants, RLS changes or business data changes.');}
 }catch(e){await c.query('rollback').catch(()=>{});console.error('Central export verification FAILED: '+(e.code||'ERROR')+' '+e.message);process.exitCode=1;}finally{await c.end().catch(()=>{});}
}
main().catch(()=>{console.error('Central export verification configuration failure');process.exitCode=1;});
