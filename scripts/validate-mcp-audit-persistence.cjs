// Validates the MCP audit migration and RLS fixture inside a rollback-only transaction.
const fs = require("node:fs");
const { Client } = require("pg");

const migrationPath =
  "supabase/migrations/202611270003_create_mcp_audit_logs.sql";
const fixturePath = "packages/crm-shared/tests/mcp-audit-rls-rollback.sql";
const expectedProject = process.argv[2];
const mode = process.argv[3] || "predeployment";

function readEnvValue(key) {
  const lines = fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
  if (lines.length !== 1) {
    throw new Error(`${key} is missing or ambiguous in .env`);
  }
  return lines[0]
    .slice(lines[0].indexOf("=") + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function matchesProject(value, key) {
  const target = new URL(value);
  if (key === "NEXT_PUBLIC_SUPABASE_URL") {
    return target.hostname.toLowerCase() === `${expectedProject}.supabase.co`;
  }
  return (
    target.hostname.toLowerCase() === `db.${expectedProject}.supabase.co` ||
    (target.hostname.toLowerCase().endsWith(".pooler.supabase.com") &&
      decodeURIComponent(target.username) === `postgres.${expectedProject}`)
  );
}

function withoutTransactionBoundaries(sql, label) {
  if (!/^\s*BEGIN;\s*$/im.test(sql) || !/COMMIT;\s*$/im.test(sql)) {
    throw new Error(`Unexpected transaction boundaries in ${label}`);
  }
  return sql
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "");
}

const auditSchemaStateQuery = `
  select c.relacl::text as table_acl,
         c.relrowsecurity as rls_enabled,
         c.relforcerowsecurity as rls_forced,
         (
           select coalesce(
             jsonb_agg(jsonb_build_array(a.attname, a.attacl::text) order by a.attnum),
             '[]'::jsonb
           )
           from pg_attribute a
           where a.attrelid = c.oid
             and a.attnum > 0
             and not a.attisdropped
         ) as column_acls,
         (
           select coalesce(
             jsonb_agg(jsonb_build_array(p.polname, pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname),
             '[]'::jsonb
           )
           from pg_policy p
           where p.polrelid = c.oid
         ) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'audit_logs'
`;

async function main() {
  if (!/^[a-z0-9]{20}$/.test(expectedProject || "")) {
    throw new Error("Supply the confirmed disposable project reference");
  }
  if (!["predeployment", "postdeployment"].includes(mode)) {
    throw new Error("Mode must be predeployment or postdeployment");
  }

  const databaseUrl = readEnvValue("DATABASE_URL");
  const supabaseUrl = readEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  if (!matchesProject(databaseUrl, "DATABASE_URL") ||
      !matchesProject(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL")) {
    throw new Error("Both environment targets must match the confirmed project");
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 12000,
  });
  let transactionStarted = false;
  let stage = "connecting";
  try {
    await client.connect();
    stage = "checking database role";
    const identity = await client.query(`
      select current_user,
             pg_has_role(current_user, 'anon', 'MEMBER') as can_set_anon,
             pg_has_role(current_user, 'authenticated', 'MEMBER') as can_set_authenticated
    `);
    if (
      identity.rows[0]?.current_user !== "postgres" ||
      !identity.rows[0]?.can_set_anon ||
      !identity.rows[0]?.can_set_authenticated
    ) {
      throw new Error("Validation requires postgres access to test Supabase roles");
    }

    stage = "checking candidate migration state";
    const initial = await client.query(`
      select to_regclass('public.audit_logs') is not null as table_exists,
             (
               select count(*)::int
               from supabase_migrations.schema_migrations
               where version = '202611270003'
             ) = 0 as receipt_absent
    `);
    const tableExists = initial.rows[0]?.table_exists;
    if (!initial.rows[0]?.receipt_absent) {
      throw new Error("Candidate migration receipt must remain absent");
    }
    if (mode === "predeployment" && tableExists) {
      throw new Error("Predeployment mode requires audit_logs to be absent");
    }
    if (mode === "postdeployment" && !tableExists) {
      throw new Error("Postdeployment mode requires audit_logs to exist");
    }

    let originalSchemaState;
    if (mode === "postdeployment") {
      stage = "capturing deployed schema state";
      const state = await client.query(auditSchemaStateQuery);
      if (state.rowCount !== 1) throw new Error("Could not inspect audit schema state");
      originalSchemaState = state.rows;
    }

    stage = "starting rollback transaction";
    await client.query("begin");
    transactionStarted = true;
    await client.query("set local lock_timeout = '3s'");
    await client.query("set local statement_timeout = '20s'");

    if (mode === "predeployment") {
      stage = "applying candidate migration transactionally";
      const migration = withoutTransactionBoundaries(
        fs.readFileSync(migrationPath, "utf8"),
        "candidate migration",
      );
      await client.query(migration);
      console.log("MCP audit migration SQL PASS");
    }

    stage = "running audit RLS regression fixture";
    const fixture = fs.readFileSync(fixturePath, "utf8");
    if (/^\s*(BEGIN|COMMIT)\s*;/im.test(fixture)) {
      throw new Error("Regression fixture must not manage its own transaction");
    }
    await client.query(fixture);
    console.log("MCP audit RLS regression assertions PASS");

    await client.query("rollback");
    transactionStarted = false;
    console.log("ROLLED BACK: migration and synthetic fixture were not persisted");

    stage = "verifying rollback integrity";
    const final = await client.query(`
      select to_regclass('public.audit_logs') is not null as table_exists,
             (
               select count(*)::int
               from supabase_migrations.schema_migrations
               where version = '202611270003'
             ) = 0 as receipt_absent
    `);
    const state = final.rows[0];
    if (
      !state.receipt_absent ||
      (mode === "predeployment" && state.table_exists) ||
      (mode === "postdeployment" && !state.table_exists)
    ) {
      throw new Error("Rollback left unexpected table, fixture, or receipt state");
    }
    if (mode === "postdeployment") {
      const fixtureRows = await client.query(`
        select count(*)::int as row_count
        from public.audit_logs
        where details ->> 'fixture' = 'mcp-audit-persistence-test'
      `);
      if (fixtureRows.rows[0]?.row_count !== 0) {
        throw new Error("Synthetic fixture rows remained after rollback");
      }
      const restored = await client.query(auditSchemaStateQuery);
      if (JSON.stringify(restored.rows) !== JSON.stringify(originalSchemaState)) {
        throw new Error("Audit table schema, grants, or policies changed after rollback");
      }
    }
    console.log("Rollback integrity verification PASS");
  } catch (error) {
    if (transactionStarted) await client.query("rollback").catch(() => {});
    console.error(
      `MCP audit validation FAILED at ${stage} (${error.code || "VALIDATION_ERROR"})`,
    );
    if (error.code === "P0001" || error.code === "P0004") {
      console.error(`Regression assertion: ${error.message}`);
    }
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Validator configuration failed (${error.code || "CONFIGURATION_ERROR"})`);
  process.exitCode = 1;
});
