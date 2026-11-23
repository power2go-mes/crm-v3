const fs=require('node:fs');const {Client}=require('pg');
async function main(){
 const ref=process.argv[2];if(!/^[a-z0-9]{20}$/.test(ref||''))throw Error('Verified project required');
 const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>/^DATABASE_URL\s*=/.test(x));if(!line)throw Error('Missing database configuration');
 const connectionString=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');const u=new URL(connectionString);
 if(u.hostname!==`db.${ref}.supabase.co`&&!(u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)===`postgres.${ref}`))throw Error('Wrong project target');
 const c=new Client({connectionString,connectionTimeoutMillis:12000});const version='202611190003';
 const sql=fs.readFileSync('supabase/migrations/202611190003_saved_dashboards.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
 try{await c.connect();const receipt=await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);if(receipt.rows.length&&!receipt.rows[0].statements?.includes(sql))throw Error('Migration receipt conflict');
 await c.query("begin;set local lock_timeout='3s';set local statement_timeout='25s'");if(!receipt.rows.length)await c.query(sql);
 await c.query(fs.readFileSync('packages/crm-shared/tests/saved-dashboard-rollback.sql','utf8'));
 await c.query('rollback');console.log('PASS: saved Dashboard create, component, folder, default swap, owner isolation, feature denial; fixtures rolled back');
 if(process.argv.includes('--apply')&&!receipt.rows.length){await c.query("begin;set local lock_timeout='3s';set local statement_timeout='25s'");await c.query(sql);await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'saved_dashboards',[sql]]);await c.query("notify pgrst,'reload schema'");await c.query('commit');console.log('Applied saved Dashboard schema to verified v3 project without role grants or business records');}
 }catch(e){await c.query('rollback').catch(()=>{});console.error('Saved Dashboard verification FAILED: '+(e.code||'ERROR')+' '+e.message);process.exitCode=1;}finally{await c.end().catch(()=>{});}
}main().catch(()=>{console.error('Saved Dashboard configuration failure');process.exitCode=1;});
