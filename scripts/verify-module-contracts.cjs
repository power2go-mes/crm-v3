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
    const schema=await client.query("select table_name,column_name,data_type from information_schema.columns where table_schema='public' and ((table_name='accounts' and column_name='account_type')or(table_name='contacts' and column_name='contact_source')or(table_name='opportunities' and column_name='lead_source')or table_name='campaigns')");
    console.log(JSON.stringify({currentContracts:schema.rows,versions:(await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x=>x.version)}));
    if(process.argv.includes('--inspect')){await client.query('rollback');return;}
    const sql=fs.readFileSync('supabase/migrations/202611160009_module_data_contracts.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
    const installed=await client.query("select statements from supabase_migrations.schema_migrations where version='202611160009'");if(installed.rows.length){if(!installed.rows[0].statements.includes(sql))throw Error('009 drift');}else await client.query(sql);
    const guard=fs.readFileSync('supabase/migrations/202611160010_module_field_writes.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');const guarded=await client.query("select statements from supabase_migrations.schema_migrations where version='202611160010'");if(guarded.rows.length){if(!guarded.rows[0].statements.includes(guard))throw Error('010 drift');}else await client.query(guard);
    const metadata=fs.readFileSync('supabase/migrations/202611170001_module_choice_metadata.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');const metaInstalled=await client.query("select statements from supabase_migrations.schema_migrations where version='202611170001'");if(metaInstalled.rows.length){if(!metaInstalled.rows[0].statements.includes(metadata))throw Error('Metadata drift');}else await client.query(metadata);
    const bounds=fs.readFileSync('supabase/migrations/202611170002_campaign_counter_bounds.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');const bounded=await client.query("select statements from supabase_migrations.schema_migrations where version='202611170002'");if(bounded.rows.length){if(!bounded.rows[0].statements.includes(bounds))throw Error('Bounds drift');}else await client.query(bounds);
    await client.query(fs.readFileSync('packages/crm-shared/tests/leads-security-rollback.sql','utf8'));
    await client.query(fs.readFileSync('packages/crm-shared/tests/module-contracts-rollback.sql','utf8'));
    await client.query('rollback');console.log('Module contract fixtures PASS; rolled back');
    if(process.argv.includes('--apply')&&!installed.rows.length){await client.query('begin');await client.query(sql);await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611160009','module_data_contracts',[sql]]);await client.query("notify pgrst,'reload schema'");await client.query('commit');console.log('009 applied; no existing business rows updated');}
    if(process.argv.includes('--apply')&&!guarded.rows.length){await client.query('begin');await client.query(guard);await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611160010','module_field_writes',[guard]]);await client.query('commit');console.log('010 field-write enforcement applied');}
    if(process.argv.includes('--apply')&&!metaInstalled.rows.length){await client.query('begin');await client.query(metadata);await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611170001','module_choice_metadata',[metadata]]);await client.query('commit');console.log('Source choice metadata applied');}
    if(process.argv.includes('--apply')&&!bounded.rows.length){await client.query('begin');await client.query(bounds);await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['202611170002','campaign_counter_bounds',[bounds]]);await client.query('commit');console.log('Campaign counter bounds applied');}
  }catch(e){await client.query('rollback').catch(()=>{});console.error('Contract verification failed: '+(e.code||'VALIDATION'));if(e.code==='P0004')console.error(e.message);process.exitCode=1;}finally{await client.end().catch(()=>{});}
}
main().catch(()=>{console.error('Configuration failure');process.exitCode=1;});
