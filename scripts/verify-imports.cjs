const fs=require('node:fs');const {Client}=require('pg');
async function main(){
 const ref=process.argv[2];if(!/^[a-z0-9]{20}$/.test(ref||''))throw Error('Verified project required');
 const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>/^DATABASE_URL\s*=/.test(x));if(!line)throw Error('Missing configuration');
 const connectionString=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');const u=new URL(connectionString);
 if(u.hostname!==`db.${ref}.supabase.co`&&!(u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)===`postgres.${ref}`))throw Error('Wrong target');
 const c=new Client({connectionString,connectionTimeoutMillis:12000});
 try{await c.connect();const sql=fs.readFileSync('supabase/migrations/202611170013_import_workflow.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
 const installed=await c.query("select statements from supabase_migrations.schema_migrations where version='202611170013'");
 if(installed.rows.length&&!installed.rows[0].statements?.includes(sql))throw Error('Migration receipt conflict');
 const correction=fs.readFileSync('supabase/migrations/202611170014_import_create_field_access.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
 const corrected=await c.query("select statements from supabase_migrations.schema_migrations where version='202611170014'");
 if(corrected.rows.length&&!corrected.rows[0].statements?.includes(correction))throw Error('Correction receipt conflict');
 await c.query("begin;set local lock_timeout='3s';set local statement_timeout='30s'");if(!installed.rows.length)await c.query(sql);if(!corrected.rows.length)await c.query(correction);
 await c.query(fs.readFileSync('packages/crm-shared/tests/imports-rollback.sql','utf8'));
 await c.query('rollback');console.log('PASS: import create/update/partial rollback/replay, ownership, cross-owner denial, immutable results, privileged mapping denial and NOBYPASSRLS executor; fixtures rolled back.');
 if(process.argv.includes('--apply')&&(!installed.rows.length||!corrected.rows.length)){
 await c.query("begin;set local lock_timeout='3s';set local statement_timeout='30s'");
 if(!installed.rows.length){await c.query(sql);await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611170013','import_workflow',[sql]]);}
 if(!corrected.rows.length){await c.query(correction);await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611170014','import_create_field_access',[correction]]);}
 await c.query("notify pgrst,'reload schema'");await c.query('commit');console.log('Applied missing forward import migrations only; no business changes or role feature grants.');}
 }catch(e){await c.query('rollback').catch(()=>{});console.error('Import verification FAILED: '+(e.code||'ERROR')+' '+e.message);process.exitCode=1;}finally{await c.end().catch(()=>{});}
}
main().catch(()=>{console.error('Import verification configuration failed');process.exitCode=1;});
