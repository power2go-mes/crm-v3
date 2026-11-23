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
    for (const file of ['202611160001_codex_shared_engines.sql', '202611160002_leads_security.sql']) {
      let sql = fs.readFileSync(`supabase/migrations/${file}`, 'utf8');
      if (!/^begin;$/m.test(sql) || !/commit;\s*$/.test(sql)) throw new Error('Unexpected transaction boundaries');
      sql = sql.replace(/^begin;\s*$/m, '').replace(/commit;\s*$/, '');
      if (installed) {
        const record = await client.query('select statements from supabase_migrations.schema_migrations where version=$1', [file.split('_')[0]]);
        if (!record.rows[0]?.statements?.includes(sql)) throw new Error('Installed migration evidence differs from local SQL');
        console.log(`${file}: installed migration evidence PASS`);
      } else {
        await client.query(sql);
        console.log(`${file}: rollback validation PASS`);
      }
    }
    if (process.argv.includes('--relationships')) {
      const sql = fs.readFileSync('supabase/migrations/202611160004_contact_accounts.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
      const applied=await client.query("select statements from supabase_migrations.schema_migrations where version='202611160004'");
      if(applied.rows.length) { if(!applied.rows[0].statements.includes(sql))throw Error('Relationship migration drift'); } else await client.query(sql);
    }
    if(process.argv.includes('--atomic')) { const sql=fs.readFileSync('supabase/migrations/202611160005_contact_atomic.sql','utf8').replace(/^begin;\s*/,'').replace(/commit;\s*$/,''); const record=await client.query("select statements from supabase_migrations.schema_migrations where version='202611160005'");if(record.rows.length){if(!record.rows[0].statements.includes(sql))throw Error('Atomic migration drift');}else await client.query(sql); }
    await client.query(fs.readFileSync('packages/crm-shared/tests/leads-security-rollback.sql', 'utf8'));
    console.log('Synthetic Leads security/conversion assertions PASS');
    if (process.argv.includes('--relationships')) { await client.query(fs.readFileSync('packages/crm-shared/tests/contact-relationships-rollback.sql','utf8')); console.log('Contact relationship creation/role/removal/legacy/foreign-scope assertions PASS'); }
    if (process.argv.includes('--contacts')) {
      await client.query(fs.readFileSync('packages/crm-shared/tests/contacts-security-rollback.sql', 'utf8'));
      console.log('Synthetic Contacts INSERT/UPDATE/account FK/ownership/permission assertions PASS');
    }
    if(process.argv.includes('--atomic')) { await client.query(fs.readFileSync('packages/crm-shared/tests/contact-atomic-rollback.sql','utf8'));console.log('Contact atomic save/hierarchy/primary assertions PASS'); }
    await client.query('rollback');
    console.log('ROLLED BACK: no migrations or fixtures persisted');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    // Never print connection strings, keys, SQL parameter values or raw database errors.
    console.error(`Rollback verification FAILED (${error.code || 'CONNECTION_OR_VALIDATION_ERROR'})`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
main().catch(() => { console.error('Validator configuration failed'); process.exitCode = 1; });
