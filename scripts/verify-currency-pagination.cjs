const fs=require('node:fs');
const {Client}=require('pg');
async function main(){
 const ref=process.argv[2];if(!/^[a-z0-9]{20}$/.test(ref||''))throw Error('Verified project required');
 const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>/^DATABASE_URL\s*=/.test(x));if(!line)throw Error('Missing configuration');
 const connectionString=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');const u=new URL(connectionString);
 if(u.hostname!==`db.${ref}.supabase.co`&&!(u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)===`postgres.${ref}`))throw Error('Wrong target');
 const c=new Client({connectionString,connectionTimeoutMillis:12000});try{
 await c.connect();const version='202611180103';const sql=fs.readFileSync('supabase/migrations/202611180103_currency_pagination.sql','utf8').replace(/^begin;\s*$/m,'').replace(/commit;\s*$/,'');
 const receipt=await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);if(receipt.rows.length&&!receipt.rows[0].statements?.includes(sql))throw Error('Migration receipt conflict');
 const grantSql="select md5(coalesce(jsonb_agg(jsonb_build_array(role_id,permission_id,is_granted) order by role_id,permission_id)::text,'[]')) fingerprint from public.role_permissions where permission_id like 'currencies.%' or permission_id like 'currency_rates.%'";
 const beforeGrants=(await c.query(grantSql)).rows[0].fingerprint;
 await c.query("begin;set local lock_timeout='3s';set local statement_timeout='25s'");if(!receipt.rows.length)await c.query(sql);
 if((await c.query(grantSql)).rows[0].fingerprint!==beforeGrants)throw Error('Candidate changed existing role grants');
 await c.query(fs.readFileSync('packages/crm-shared/tests/currency-settings-rollback.sql','utf8'));await c.query(fs.readFileSync('packages/crm-shared/tests/currency-pagination-rollback.sql','utf8'));await c.query('rollback');console.log('PASS: Currency core regressions plus bounded static/dated server pages, page validation and denied dated reads; fixtures rolled back.');
 if(process.argv.includes('--apply')&&!receipt.rows.length){await c.query("begin;set local lock_timeout='3s';set local statement_timeout='25s'");await c.query(sql);await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'currency_pagination',[sql]]);await c.query("notify pgrst,'reload schema'");await c.query('commit');console.log('Applied server-paged Currency catalog only; no role grants or stored rates changed.');}
 }catch(e){await c.query('rollback').catch(()=>{});console.error('Currency verification FAILED: '+(e.code||'ERROR')+' '+e.message);if(e.where)console.error(e.where.slice(-1200));if(e.detail)console.error(e.detail);process.exitCode=1;}finally{await c.end().catch(()=>{});}
}
main().catch(()=>{console.error('Currency configuration failure');process.exitCode=1;});
