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
  client.on('error',()=>{ process.exitCode=1; });
  try {
    await client.connect();
    await client.query("begin; set local lock_timeout='3s'; set local statement_timeout='20s'");
    if(process.argv.includes('--inspect')) { const columns=await client.query("select table_name,column_name from information_schema.columns where table_schema='public' and ((table_name='accounts' and column_name='account_type') or (table_name='campaigns' and column_name='campaign_type') or (table_name='opportunities' and column_name='lead_source'))");console.log(JSON.stringify({availableChartDependencies:columns.rows})); }
    const file='202611160006_dashboard.sql';
    const sql=fs.readFileSync('supabase/migrations/'+file,'utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
    const installed=await client.query("select statements from supabase_migrations.schema_migrations where version='202611160006'");
    if(installed.rows.length){if(!installed.rows[0].statements.includes(sql))throw Error('Migration drift');}
    else { const existing=await client.query("select tablename from pg_tables where schemaname='public' and tablename like '%dashboard%'");if(existing.rows.length)throw Error('Existing Dashboard persistence requires reuse review');await client.query(sql); }
    const guard=fs.readFileSync('supabase/migrations/202611160007_dashboard_field_access.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
    await client.query(guard);
    const tables=fs.readFileSync('supabase/migrations/202611160008_dashboard_tables.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
    if(process.argv.includes('--tables')){const record=await client.query("select statements from supabase_migrations.schema_migrations where version='202611160008'");if(record.rows.length){if(!record.rows[0].statements.includes(tables))throw Error('Table migration drift');}else await client.query(tables);}
    await client.query(fs.readFileSync('packages/crm-shared/tests/leads-security-rollback.sql','utf8'));
    await client.query(fs.readFileSync('packages/crm-shared/tests/dashboard-rollback.sql','utf8'));
    if(process.argv.includes('--tables'))await client.query(fs.readFileSync('packages/crm-shared/tests/dashboard-tables-rollback.sql','utf8'));
    await client.query('rollback');console.log('Dashboard aggregates/filter/layout/permission assertions PASS; fixtures rolled back');
    if(process.argv.includes('--apply-tables')){const prior=await client.query("select 1 from supabase_migrations.schema_migrations where version='202611160008'");if(!prior.rows.length){await client.query('begin');await client.query(tables);await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611160008','dashboard_tables',[tables]]);await client.query("notify pgrst,'reload schema'");await client.query('commit');console.log('Dashboard table migration applied');}}
    if(process.argv.includes('--apply-field-guard')) { const prior=await client.query("select 1 from supabase_migrations.schema_migrations where version='202611160007'");if(!prior.rows.length){await client.query('begin');await client.query(guard);await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611160007','dashboard_field_access',[guard]]);await client.query('commit');console.log('Dashboard field-access guard applied');} }
    if(process.argv.includes('--apply')&&!installed.rows.length){
      await client.query('begin');await client.query(sql);
      await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611160006','dashboard',[sql]]);
      await client.query("notify pgrst,'reload schema'");await client.query('commit');console.log('Dashboard migration applied to verified target');
    }
  }catch(e){await client.query('rollback').catch(()=>{});console.error('Dashboard verification failed: '+(e.code||'VALIDATION'));if(e.code==='P0004')console.error(e.message);process.exitCode=1;}finally{await client.end().catch(()=>{});}
}
main().catch(()=>{console.error('Configuration failure');process.exitCode=1;});
