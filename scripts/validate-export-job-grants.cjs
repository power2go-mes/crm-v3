// Rollback-only PostgreSQL verification. Never applies migrations or commits fixtures.
const fs = require("node:fs");
const { Client } = require("pg");

async function main() {
  const expectedProject = process.argv[2];
  if (!/^[a-z0-9]{20}$/.test(expectedProject || "")) {
    throw new Error(
      "Supply the independently verified disposable project reference",
    );
  }

  const line = fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((value) => /^\s*DATABASE_URL\s*=/.test(value));
  if (!line) throw new Error("DATABASE_URL is not configured in .env");

  const connectionString = line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const target = new URL(connectionString);
  const isDirectTarget =
    target.hostname === `db.${expectedProject}.supabase.co`;
  const isPoolerTarget =
    target.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(target.username) === `postgres.${expectedProject}`;
  if (!isDirectTarget && !isPoolerTarget) {
    throw new Error(
      "Database target does not match the confirmed disposable project",
    );
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 12000,
  });
  let transactionStarted = false;
  let stage = "connecting";
  let databaseRole = "unknown";
  let canSetAnon = "unknown";
  let canSetAuthenticated = "unknown";
  let originalGrantState;
  try {
    await client.connect();
    stage = "checking database role";
    const identity = await client.query(`
      select current_user,
             pg_has_role(current_user, 'anon', 'MEMBER') as can_set_anon,
             pg_has_role(current_user, 'authenticated', 'MEMBER') as can_set_authenticated
    `);
    databaseRole = identity.rows[0]?.current_user || "unknown";
    canSetAnon = String(identity.rows[0]?.can_set_anon);
    canSetAuthenticated = String(identity.rows[0]?.can_set_authenticated);
    if (
      databaseRole !== "postgres" ||
      canSetAnon !== "true" ||
      canSetAuthenticated !== "true"
    ) {
      throw new Error(
        "Rollback verification requires postgres access to test roles",
      );
    }

    stage = "capturing original effective grants";
    const grantStateQuery = `
      select has_table_privilege('authenticated', 'public.crm_export_jobs', 'SELECT') as auth_select,
             has_table_privilege('authenticated', 'public.crm_export_jobs', 'INSERT') as auth_insert,
             has_table_privilege('authenticated', 'public.crm_export_jobs', 'UPDATE') as auth_update,
             has_table_privilege('authenticated', 'public.crm_export_jobs', 'DELETE') as auth_delete,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'module', 'INSERT') as insert_module,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'columns', 'INSERT') as insert_columns,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'time_zone', 'INSERT') as insert_time_zone,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'status', 'INSERT') as insert_status,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'status', 'UPDATE') as update_status,
             has_table_privilege('anon', 'public.crm_export_jobs', 'SELECT') as anon_select,
             has_table_privilege('anon', 'public.crm_export_jobs', 'INSERT') as anon_insert,
             has_table_privilege('anon', 'public.crm_export_jobs', 'UPDATE') as anon_update,
             has_table_privilege('anon', 'public.crm_export_jobs', 'DELETE') as anon_delete
    `;
    originalGrantState = await client.query(grantStateQuery);
    if (originalGrantState.rowCount !== 1)
      throw new Error("Could not inspect export-job grants");
    stage = "capturing original ACL state";
    const grantAclQuery = `
      select c.relacl::text as table_acl,
             (
               select coalesce(
                 jsonb_agg(jsonb_build_array(a.attname, a.attacl::text) order by a.attnum),
                 '[]'::jsonb
               )
               from pg_attribute a
               where a.attrelid = c.oid
                 and a.attnum > 0
                 and not a.attisdropped
             ) as column_acls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'crm_export_jobs'
    `;
    const originalAclState = await client.query(grantAclQuery);
    if (originalAclState.rowCount !== 1)
      throw new Error("Could not inspect export-job ACLs");

    stage = "starting rollback transaction";
    await client.query("begin");
    transactionStarted = true;
    await client.query("set local lock_timeout = '3s'");
    await client.query("set local statement_timeout = '20s'");

    stage = "applying export-job grant migration";
    let migration = fs.readFileSync(
      "supabase/migrations/202611270002_restrict_crm_export_job_grants.sql",
      "utf8",
    );
    if (
      !/^\s*BEGIN;\s*$/im.test(migration) ||
      !/COMMIT;\s*$/im.test(migration)
    ) {
      throw new Error("Unexpected migration transaction boundaries");
    }
    migration = migration
      .replace(/^\s*BEGIN;\s*/i, "")
      .replace(/\s*COMMIT;\s*$/i, "");
    await client.query(migration);
    console.log("Export-job grant migration SQL PASS");

    stage = "running export-job grant regression fixture";
    const fixture = fs.readFileSync(
      "packages/crm-shared/tests/export-job-grants-rollback.sql",
      "utf8",
    );
    if (/^\s*(BEGIN|COMMIT)\s*;/im.test(fixture)) {
      throw new Error("Regression fixture must not manage its own transaction");
    }
    await client.query(fixture);
    console.log("Export-job grant regression assertions PASS");

    await client.query("rollback");
    transactionStarted = false;
    console.log("ROLLED BACK: migration and fixtures were not persisted");

    stage = "verifying rollback integrity";
    const restoredGrantState = await client.query(grantStateQuery);
    const restoredAclState = await client.query(grantAclQuery);
    if (
      JSON.stringify(restoredGrantState.rows) !==
        JSON.stringify(originalGrantState.rows) ||
      JSON.stringify(restoredAclState.rows) !==
        JSON.stringify(originalAclState.rows)
    ) {
      throw new Error("Export-job grants changed after rollback");
    }
    console.log("Rollback integrity verification PASS");
  } catch (error) {
    if (transactionStarted) await client.query("rollback").catch(() => {});
    const identityDetails =
      stage === "checking database role"
        ? `; role=${databaseRole}; can_set_anon=${canSetAnon}; can_set_authenticated=${canSetAuthenticated}`
        : "";
    console.error(
      `Rollback verification FAILED at ${stage} (${error.code || "CONFIGURATION_OR_VALIDATION_ERROR"}${identityDetails})`,
    );
    if (error.code === "P0001" || error.code === "P0004")
      console.error(`Regression assertion: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(
    `Validator configuration failed (${error.code || "CONFIGURATION_ERROR"})`,
  );
  process.exitCode = 1;
});
