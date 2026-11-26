// Rollback-only PostgreSQL verification. Never applies migrations or commits fixtures.
const fs = require('node:fs');
const { Client } = require('pg');

async function main() {
  const expectedProject = process.argv[2];
  if (!/^[a-z0-9]{20}$/.test(expectedProject || '')) {
    throw new Error('Supply the independently verified disposable project reference');
  }

  const line = fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find(value => /^DATABASE_URL\s*=/.test(value));
  if (!line) throw new Error('DATABASE_URL is not configured in .env');

  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const target = new URL(connectionString);
  const isDirectTarget = target.hostname === `db.${expectedProject}.supabase.co`;
  const isPoolerTarget = target.hostname.endsWith('.pooler.supabase.com')
    && decodeURIComponent(target.username) === `postgres.${expectedProject}`;
  if (!isDirectTarget && !isPoolerTarget) {
    throw new Error('Database target does not match the confirmed disposable project');
  }

  const client = new Client({ connectionString, connectionTimeoutMillis: 12000 });
  let transactionStarted = false;
  let stage = 'connecting';
  let databaseRole = 'unknown';
  let canSetAnon = 'unknown';
  let canSetAuthenticated = 'unknown';
  let originalFunctionState;
  try {
    await client.connect();
    stage = 'checking database role';
    const identity = await client.query(
      `select current_user,
              pg_has_role(current_user, 'anon', 'MEMBER') as can_set_anon,
              pg_has_role(current_user, 'authenticated', 'MEMBER') as can_set_authenticated`
    );
    databaseRole = identity.rows[0]?.current_user || 'unknown';
    canSetAnon = String(identity.rows[0]?.can_set_anon);
    canSetAuthenticated = String(identity.rows[0]?.can_set_authenticated);
    if (databaseRole !== 'postgres' || canSetAnon !== 'true' || canSetAuthenticated !== 'true') {
      throw new Error('Rollback verification requires the postgres role and test-role membership');
    }

    originalFunctionState = await client.query(`
      select p.prosecdef as security_definer,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
             has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
      from pg_proc p
      where p.oid = 'public.execute_custom_report(uuid,jsonb)'::regprocedure
    `);
    if (originalFunctionState.rowCount !== 1) {
      throw new Error('Report RPC does not exist in the configured database');
    }

    stage = 'starting rollback transaction';
    await client.query('begin');
    transactionStarted = true;
    await client.query("set local lock_timeout = '3s'");
    await client.query("set local statement_timeout = '20s'");

    stage = 'applying report RPC migration';
    const migrationPath = 'supabase/migrations/20261126143718_secure_custom_report_rpc.sql';
    let migration = fs.readFileSync(migrationPath, 'utf8');
    if (!/^\s*BEGIN;\s*$/im.test(migration) || !/COMMIT;\s*$/im.test(migration)) {
      throw new Error('Unexpected migration transaction boundaries');
    }
    migration = migration.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
    await client.query(migration);
    console.log('Report RPC migration SQL PASS');

    stage = 'running report RPC regression fixture';
    const fixturePath = 'packages/crm-shared/tests/custom-report-security-rollback.sql';
    const fixture = fs.readFileSync(fixturePath, 'utf8');
    if (/^\s*(BEGIN|COMMIT)\s*;/im.test(fixture)) {
      throw new Error('Regression fixture must not manage its own transaction');
    }
    await client.query(fixture);
    console.log('Report RPC security regression assertions PASS');

    await client.query('rollback');
    transactionStarted = false;
    console.log('ROLLED BACK: migration and synthetic fixtures were not persisted');

    stage = 'verifying rollback integrity';
    const restoredFunctionState = await client.query(`
      select p.prosecdef as security_definer,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
             has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
      from pg_proc p
      where p.oid = 'public.execute_custom_report(uuid,jsonb)'::regprocedure
    `);
    const fixtureUsers = await client.query(
      'select count(*)::integer as count from auth.users where id = any($1::uuid[])',
      [[
        'c0de0000-0000-4000-8000-000000008311',
        'c0de0000-0000-4000-8000-000000008312',
        'c0de0000-0000-4000-8000-000000008313',
        'c0de0000-0000-4000-8000-000000008314',
        'c0de0000-0000-4000-8000-000000008315',
      ]]
    );
    if (JSON.stringify(restoredFunctionState.rows) !== JSON.stringify(originalFunctionState.rows)
      || fixtureUsers.rows[0]?.count !== 0) {
      throw new Error('Database state changed after rollback');
    }
    console.log('Rollback integrity verification PASS');
  } catch (error) {
    if (transactionStarted) await client.query('rollback').catch(() => {});
    const identityDetails = stage === 'checking database role'
      ? `; role=${databaseRole}; can_set_anon=${canSetAnon}; can_set_authenticated=${canSetAuthenticated}`
      : '';
    console.error(`Rollback verification FAILED at ${stage} (${error.code || 'CONFIGURATION_OR_VALIDATION_ERROR'}${identityDetails})`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch(error => {
  console.error(`Validator configuration failed (${error.code || 'CONFIGURATION_ERROR'})`);
  process.exitCode = 1;
});
