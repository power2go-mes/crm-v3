// Validates real PostgreSQL RLS behavior for synthetic CRM roles in a rollback-only transaction.
const fs = require("node:fs");
const { Client } = require("pg");

const expectedProject = process.argv[2];
const fixturePath = "packages/crm-shared/tests/mcp-six-role-rls-rollback.sql";
const fixtureCompany = "MCP-RLS-20261126-FIXTURE";
const userIds = {
  SUPER_ADMIN: "f1000000-0000-4000-8000-000000000001",
  HEAD_OF_SALES: "f1000000-0000-4000-8000-000000000002",
  RSM_A: "f1000000-0000-4000-8000-000000000003",
  SSM_A: "f1000000-0000-4000-8000-000000000004",
  ASM_A: "f1000000-0000-4000-8000-000000000005",
  BDO_A: "f1000000-0000-4000-8000-000000000006",
  RSM_B: "f1000000-0000-4000-8000-000000000007",
  SSM_B: "f1000000-0000-4000-8000-000000000008",
  ASM_B: "f1000000-0000-4000-8000-000000000009",
  BDO_B: "f1000000-0000-4000-8000-000000000010",
};
const leadIds = Array.from({ length: 10 }, (_, index) =>
  `f3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const regionIds = [
  "f2000000-0000-4000-8000-000000000001",
  "f2000000-0000-4000-8000-000000000002",
];
const emailValues = [
  "mcp-rls-sa@example.test",
  "mcp-rls-hos@example.test",
  "mcp-rls-rsm-a@example.test",
  "mcp-rls-ssm-a@example.test",
  "mcp-rls-asm-a@example.test",
  "mcp-rls-bdo-a@example.test",
  "mcp-rls-rsm-b@example.test",
  "mcp-rls-ssm-b@example.test",
  "mcp-rls-asm-b@example.test",
  "mcp-rls-bdo-b@example.test",
];

function readEnvValue(key) {
  const lines = fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
  if (lines.length !== 1) throw new Error(`${key} is missing or ambiguous in .env`);
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

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}; expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
  }
}

async function main() {
  if (!/^[a-z0-9]{20}$/.test(expectedProject || "")) {
    throw new Error("Supply the confirmed disposable project reference");
  }
  const databaseUrl = readEnvValue("DATABASE_URL");
  if (
    !matchesProject(databaseUrl, "DATABASE_URL") ||
    !matchesProject(readEnvValue("NEXT_PUBLIC_SUPABASE_URL"), "NEXT_PUBLIC_SUPABASE_URL")
  ) {
    throw new Error("Both environment targets must match the confirmed project");
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 12000,
  });
  let transactionStarted = false;
  let stage = "connecting";
  let originalLedgerCount;
  try {
    await client.connect();
    stage = "checking database role and grants";
    const identity = await client.query(`
      select current_user,
             pg_has_role(current_user, 'authenticated', 'MEMBER') as can_set_authenticated,
             has_column_privilege('authenticated', 'public.leads', 'company_name', 'SELECT') as can_select_company,
             has_column_privilege('authenticated', 'public.leads', 'lead_owner_id', 'SELECT') as can_select_owner,
             has_column_privilege('authenticated', 'public.leads', 'title', 'INSERT') as can_insert_title,
             has_column_privilege('authenticated', 'public.leads', 'lead_owner_id', 'INSERT') as can_insert_owner,
             has_column_privilege('authenticated', 'public.leads', 'created_by_id', 'INSERT') as can_insert_creator
    `);
    const connection = identity.rows[0];
    if (
      connection.current_user !== "postgres" ||
      !connection.can_set_authenticated ||
      !connection.can_select_company ||
      !connection.can_select_owner ||
      !connection.can_insert_title ||
      !connection.can_insert_owner ||
      !connection.can_insert_creator
    ) {
      throw new Error("Postgres role or authenticated Lead grants do not match test requirements");
    }

    stage = "checking synthetic fixture identifiers";
    const idState = await client.query(
      `
        select
          exists(select 1 from auth.users where id = any($1::uuid[])) as user_id_exists,
          exists(select 1 from public.sales_regions where id = any($2::uuid[])) as region_id_exists,
          exists(select 1 from public.leads where id = any($3::uuid[])) as lead_id_exists,
          exists(select 1 from auth.users where email = any($4::text[])) as email_exists,
          exists(select 1 from public.sales_regions where code in ('MCP_RLS_FIXTURE_A', 'MCP_RLS_FIXTURE_B')) as region_code_exists,
          exists(select 1 from public.leads where company_name = $5) as fixture_company_exists
      `,
      [Object.values(userIds), regionIds, leadIds, emailValues, fixtureCompany],
    );
    if (Object.values(idState.rows[0]).some(Boolean)) {
      throw new Error("A synthetic fixture identifier already exists; refusing to overwrite it");
    }

    stage = "checking canonical roles and permission expectations";
    const roleState = await client.query(`
      select r.id,
             r.is_canonical,
             r.is_active,
             coalesce(bool_or(rp.permission_id = 'leads.view' and rp.is_granted), false) as can_view,
             coalesce(bool_or(rp.permission_id = 'leads.create' and rp.is_granted), false) as can_create
      from public.roles r
      left join public.role_permissions rp on rp.role_id = r.id
      where r.id in ('SUPER_ADMIN', 'HEAD_OF_SALES', 'RSM', 'SSM', 'ASM', 'BDO')
      group by r.id, r.is_canonical, r.is_active
      order by r.id
    `);
    const expectedRolePermissions = {
      ASM: { view: true, create: true },
      BDO: { view: true, create: false },
      HEAD_OF_SALES: { view: true, create: true },
      RSM: { view: true, create: true },
      SSM: { view: true, create: true },
      SUPER_ADMIN: { view: true, create: true },
    };
    if (roleState.rowCount !== 6) throw new Error("Expected all six canonical CRM roles");
    for (const role of roleState.rows) {
      const expected = expectedRolePermissions[role.id];
      if (!role.is_canonical || !role.is_active || role.can_view !== expected.view || role.can_create !== expected.create) {
        throw new Error(`Unexpected canonical permission configuration for ${role.id}`);
      }
    }
    originalLedgerCount = await client.query(
      "select count(*)::int as count from supabase_migrations.schema_migrations",
    );

    stage = "starting rollback-only role RLS transaction";
    await client.query("begin");
    transactionStarted = true;
    await client.query("set local lock_timeout = '3s'");
    await client.query("set local statement_timeout = '30s'");
    await client.query("set local crm.allow_reassign = 'on'");

    stage = "creating synthetic role, region, hierarchy, and Lead fixtures";
    const fixture = fs.readFileSync(fixturePath, "utf8");
    if (/^\s*(BEGIN|COMMIT)\s*;/im.test(fixture)) {
      throw new Error("Fixture must not manage its own transaction");
    }
    await client.query(fixture);

    const visibility = {
      SUPER_ADMIN: Object.values(userIds),
      HEAD_OF_SALES: Object.values(userIds),
      RSM_A: [userIds.RSM_A, userIds.SSM_A, userIds.ASM_A, userIds.BDO_A],
      SSM_A: [userIds.SSM_A, userIds.ASM_A, userIds.BDO_A],
      ASM_A: [userIds.ASM_A, userIds.BDO_A],
      BDO_A: [userIds.BDO_A],
      RSM_B: [userIds.RSM_B, userIds.SSM_B, userIds.ASM_B, userIds.BDO_B],
      SSM_B: [userIds.SSM_B, userIds.ASM_B, userIds.BDO_B],
      ASM_B: [userIds.ASM_B, userIds.BDO_B],
      BDO_B: [userIds.BDO_B],
    };
    const ownerToLeadId = Object.fromEntries(
      Object.keys(userIds).map((key, index) => [userIds[key], leadIds[index]]),
    );

    for (const [role, userId] of Object.entries(userIds)) {
      stage = `testing ${role} Lead visibility`;
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      await client.query("set local role authenticated");
      const visible = await client.query(
        "select lead_owner_id::text as owner_id from public.leads where company_name = $1 order by lead_owner_id",
        [fixtureCompany],
      );
      await client.query("reset role");
      await client.query("select set_config('request.jwt.claims', '{}', true)");

      const expectedOwners = visibility[role]
        .map((ownerId) => ownerToLeadId[ownerId] && ownerId)
        .filter(Boolean)
        .sort();
      const actualOwners = visible.rows.map((row) => row.owner_id).sort();
      assertEqual(actualOwners, expectedOwners, `${role} Lead row scope mismatch`);
    }
    console.log("Six-role regional Lead visibility and cross-region isolation PASS");

    const canCreate = new Set(["SUPER_ADMIN", "HEAD_OF_SALES", "RSM", "SSM", "ASM"]);
    for (const [role, userId] of Object.entries(userIds)) {
      const shouldCreate = canCreate.has(role.replace(/_[AB]$/, ""));
      stage = `testing ${role} Lead creation permission`;
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      await client.query("set local role authenticated");
      await client.query("savepoint role_lead_create");
      let insertSucceeded = false;
      try {
        await client.query(
          `
            insert into public.leads (
              title, first_name, last_name, company_name, lead_owner_id, created_by_id, lead_source
            )
            values ('MCP RLS create fixture', 'Test', $1, $2, $3::uuid, $3::uuid, 'MCP_RLS_TEST')
          `,
          [role, `${fixtureCompany}_CREATE_${role}`, userId],
        );
        insertSucceeded = true;
      } catch (error) {
        if (shouldCreate || error.code !== "42501") throw error;
        await client.query("rollback to savepoint role_lead_create");
      }
      await client.query("release savepoint role_lead_create");
      await client.query("reset role");
      await client.query("select set_config('request.jwt.claims', '{}', true)");
      if (insertSucceeded !== shouldCreate) {
        throw new Error(`${role} Lead create policy did not match its permission grant`);
      }
    }
    console.log("Six-role Lead create permission/RLS checks PASS");

    await client.query("rollback");
    transactionStarted = false;
    console.log("ROLLED BACK: synthetic auth users, roles, regions, relationships, Leads, and history");

    stage = "verifying rollback integrity";
    const after = await client.query(
      `
        select
          exists(select 1 from auth.users where id = any($1::uuid[])) as users_remain,
          exists(select 1 from public.user_profiles where id = any($1::uuid[])) as profiles_remain,
          exists(select 1 from public.user_roles where user_id = any($1::uuid[])) as roles_remain,
          exists(select 1 from public.sales_reporting_relationships where user_id = any($1::uuid[])) as relationships_remain,
          exists(select 1 from public.sales_regions where id = any($2::uuid[])) as regions_remain,
          exists(select 1 from public.leads where id = any($3::uuid[]) or company_name like $4) as leads_remain
      `,
      [Object.values(userIds), regionIds, leadIds, `${fixtureCompany}%`],
    );
    const ledgerAfter = await client.query(
      "select count(*)::int as count from supabase_migrations.schema_migrations",
    );
    if (
      Object.values(after.rows[0]).some(Boolean) ||
      ledgerAfter.rows[0].count !== originalLedgerCount.rows[0].count
    ) {
      throw new Error("Synthetic fixture or migration-ledger changes remained after rollback");
    }
    console.log("Rollback integrity and unchanged migration ledger PASS");
  } catch (error) {
    if (transactionStarted) await client.query("rollback").catch(() => {});
    console.error(
      `Six-role RLS validation FAILED at ${stage} (${error.code || "VALIDATION_ERROR"}): ${error.message}`,
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Validator configuration failed (${error.code || "CONFIGURATION_ERROR"})`);
  process.exitCode = 1;
});
