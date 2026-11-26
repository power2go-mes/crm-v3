const crypto = require('node:crypto');
const fs = require('node:fs');
const { Client } = require('pg');

const expectedProject = process.argv[2];
if (!/^[a-z0-9]{20}$/.test(expectedProject || '')) {
  console.error('Supply the independently verified Supabase project reference.');
  process.exit(1);
}

const baselinePhase = process.argv[3] || 'predeployment';
if (!['predeployment', 'after-rpc-security', 'final'].includes(baselinePhase)) {
  console.error('Use one of: predeployment, after-rpc-security, final.');
  process.exit(1);
}

function readDatabaseUrl() {
  const env = fs.readFileSync('.env', 'utf8');
  const line = env.split(/\r?\n/).find(value => /^\s*DATABASE_URL\s*=/.test(value));
  if (!line) throw new Error('DATABASE_URL is not configured in .env');
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}

function matchesProject(connectionString) {
  const target = new URL(connectionString);
  const direct = target.hostname === `db.${expectedProject}.supabase.co`;
  const pooler = target.hostname.endsWith('.pooler.supabase.com')
    && decodeURIComponent(target.username) === `postgres.${expectedProject}`;
  return direct || pooler;
}

const requiredFunctions = [
  'public.prevent_lead_delete_with_attachments()',
  'public.is_opportunity_team_member(uuid,uuid,text)',
  'public.account_exists(uuid)',
  'public.guard_opportunity_owner_update()',
  'public.add_opportunity_team_member(uuid,uuid,text,text,numeric)',
  'public.evaluate_and_assign_lead(uuid)',
  'public.submit_web_to_lead(uuid,jsonb)',
  'public.track_lead_updated_by()',
  'public.leads_chart_aggregate(text,text,jsonb,boolean)',
  'public.lead_bulk_change(uuid[],text)',
  'public.lead_is_live(uuid)',
  'public.lead_archive_selected(uuid[])',
  'public.lead_archived_list(integer)',
  'public.lead_restore(uuid)',
  'public.read_module_records(text,uuid,integer,integer)',
  'public.dashboard_home_metrics(date,date)',
  'public.can_access_opportunity(uuid,text)',
  'public.recalculate_opportunity_item_totals()',
  'public.set_opportunity_price_sync_mode(uuid,text)',
  'public.generate_quote_number()',
  'public.save_quote_revision_snapshot(uuid)',
  'public.leads_report_summary(text)',
  'public.run_lead_import(uuid,jsonb,text,text[],integer)',
  'public.claim_crm_export_job(uuid)',
  'public.complete_crm_export_batch(uuid,uuid,uuid,integer,bigint,boolean)',
  'public.release_crm_export_job(uuid,uuid,text,boolean)',
  'public.execute_custom_report(uuid,jsonb)',
  'public.generate_sales_reminders(uuid)',
];

const expectedPreDeploymentRpcs = [
  {
    signature: 'public.execute_custom_report(uuid,jsonb)',
    sha256: '25b3cde5296797cae2c6caeec9478a98aa0c558ecf76544cb48a7d28e5249d9c',
    securityDefiner: true,
    anonExecute: true,
    authenticatedExecute: true,
    serviceExecute: true,
    publicExecute: true,
  },
  {
    signature: 'public.generate_sales_reminders(uuid)',
    sha256: '93da889249da749df0a444d9e14afaecfe92ae253a70f15cda27920bda62ff3d',
    securityDefiner: true,
    anonExecute: true,
    authenticatedExecute: true,
    serviceExecute: true,
    publicExecute: true,
  },
];

const expectedSecuredRpcs = [
  {
    signature: 'public.execute_custom_report(uuid,jsonb)',
    sha256: '460d61b6366bb473ceb1a46e08fafee10a4749b84d0638846823a100598405c2',
    securityDefiner: false,
    anonExecute: false,
    authenticatedExecute: true,
    serviceExecute: false,
    publicExecute: false,
  },
  {
    signature: 'public.generate_sales_reminders(uuid)',
    sha256: '40e0db48537fda99f16a2c53f0646965f117f23def3dfdebaef1f44c0b9b1fdb',
    securityDefiner: true,
    anonExecute: false,
    authenticatedExecute: true,
    serviceExecute: true,
    publicExecute: false,
  },
];

const requiredTables = [
  'lead_notes',
  'lead_archives',
  'crm_import_jobs',
  'crm_export_jobs',
  'crm_products',
  'crm_price_books',
  'crm_price_book_entries',
  'crm_opportunity_line_items',
  'crm_quotes',
  'crm_quote_line_items',
  'crm_quote_revisions',
];

const requiredIndexes = [
  'lead_notes_lead_id',
  'idx_leads_live_created_id',
  'idx_leads_live_updated_id',
  'idx_leads_live_owner_created_id',
  'idx_leads_live_sub_owner_created_id',
  'idx_leads_import_match_email',
  'idx_leads_import_match_phone',
  'idx_leads_import_match_first_name',
  'idx_leads_import_match_last_name',
  'idx_leads_import_match_company_name',
  'idx_leads_website_email_created',
  'crm_export_jobs_owner_created',
  'crm_export_jobs_one_active_per_user',
  'crm_products_sku_upper_idx',
  'crm_products_category_idx',
  'crm_products_active_idx',
  'crm_price_books_active_idx',
  'crm_price_books_standard_idx',
  'crm_pbe_book_idx',
  'crm_pbe_product_idx',
  'crm_opp_line_items_opp_idx',
  'crm_opp_line_items_product_idx',
  'crm_quotes_opp_idx',
  'crm_quotes_status_idx',
  'crm_quotes_number_idx',
  'crm_quote_line_items_quote_idx',
  'crm_quote_revisions_quote_idx',
];

const requiredPolicies = [
  ['opportunities_scoped_read', 'public', 'opportunities'],
  ['opportunities_scoped_update', 'public', 'opportunities'],
  ['opp_team_members_manage', 'public', 'opportunity_team_members'],
  ['lead_notes_read', 'public', 'lead_notes'],
  ['lead_notes_insert', 'public', 'lead_notes'],
  ['lead_notes_edit', 'public', 'lead_notes'],
  ['lead_notes_remove', 'public', 'lead_notes'],
  ['lead_live_scope', 'public', 'leads'],
  ['lead_recovery_requires_archive', 'public', 'leads'],
  ['crm_products_read', 'public', 'crm_products'],
  ['crm_products_insert', 'public', 'crm_products'],
  ['crm_products_update', 'public', 'crm_products'],
  ['crm_products_delete', 'public', 'crm_products'],
  ['crm_price_books_read', 'public', 'crm_price_books'],
  ['crm_price_books_insert', 'public', 'crm_price_books'],
  ['crm_price_books_update', 'public', 'crm_price_books'],
  ['crm_price_books_delete', 'public', 'crm_price_books'],
  ['crm_pbe_read', 'public', 'crm_price_book_entries'],
  ['crm_pbe_insert', 'public', 'crm_price_book_entries'],
  ['crm_pbe_update', 'public', 'crm_price_book_entries'],
  ['crm_pbe_delete', 'public', 'crm_price_book_entries'],
  ['crm_opp_items_read', 'public', 'crm_opportunity_line_items'],
  ['crm_opp_items_insert', 'public', 'crm_opportunity_line_items'],
  ['crm_opp_items_update', 'public', 'crm_opportunity_line_items'],
  ['crm_opp_items_delete', 'public', 'crm_opportunity_line_items'],
  ['crm_quotes_read', 'public', 'crm_quotes'],
  ['crm_quotes_insert', 'public', 'crm_quotes'],
  ['crm_quotes_update', 'public', 'crm_quotes'],
  ['crm_quotes_delete', 'public', 'crm_quotes'],
  ['crm_quote_items_read', 'public', 'crm_quote_line_items'],
  ['crm_quote_items_insert', 'public', 'crm_quote_line_items'],
  ['crm_quote_items_update', 'public', 'crm_quote_line_items'],
  ['crm_quote_items_delete', 'public', 'crm_quote_line_items'],
  ['crm_quote_rev_read', 'public', 'crm_quote_revisions'],
  ['crm_quote_rev_insert', 'public', 'crm_quote_revisions'],
  ['crm_export_jobs_select_own', 'public', 'crm_export_jobs'],
  ['crm_export_jobs_insert_own', 'public', 'crm_export_jobs'],
  ['crm_export_jobs_update_own', 'public', 'crm_export_jobs'],
  ['crm_export_files_select_own', 'storage', 'objects'],
  ['crm_export_files_insert_own', 'storage', 'objects'],
  ['crm_export_files_update_own', 'storage', 'objects'],
  ['crm_export_files_delete_own', 'storage', 'objects'],
];

const requiredConstraints = [
  'crm_export_jobs_columns_check',
  'crm_export_jobs_module_check',
  'crm_export_jobs_output_bytes_check',
  'crm_export_jobs_part_count_check',
  'crm_export_jobs_pkey',
  'crm_export_jobs_processed_rows_check',
  'crm_export_jobs_status_check',
  'crm_export_jobs_time_zone_check',
  'crm_export_jobs_user_id_fkey',
];

const requiredTriggers = [
  ['prevent_lead_delete_with_attachments', 'leads', 'prevent_lead_delete_with_attachments'],
  ['trg_guard_opportunity_owner_update', 'opportunities', 'guard_opportunity_owner_update'],
  ['zz_track_lead_updated_by', 'leads', 'track_lead_updated_by'],
  ['trg_recalc_opp_item_totals', 'crm_opportunity_line_items', 'recalculate_opportunity_item_totals'],
];

const requiredColumns = [
  ['leads', 'is_active'],
  ['leads', 'updated_by_id'],
  ['leads', 'sub_owner_id'],
  ['crm_import_jobs', 'headers'],
  ['crm_import_jobs', 'rows'],
  ['crm_import_jobs', 'configuration'],
  ['crm_import_jobs', 'result'],
  ['crm_import_jobs', 'completed_at'],
  ['crm_export_jobs', 'claim_token'],
  ['crm_export_jobs', 'lease_expires_at'],
  ['crm_export_jobs', 'processed_rows'],
];

const expectedReceipts = [
  '202611200004',
  '202611200005',
  '202611200006',
  '202611200007',
  '202611200008',
  '202611200009',
  '202611200010',
];

const unappliedReceipts = [
  '202611260001',
  '202611260002',
  '202611260003',
  '202611260004',
  '202611260005',
  '202611260006',
  '20261126143718',
  '202611270001',
];

async function main() {
  let connectionString;
  try {
    connectionString = readDatabaseUrl();
    if (!matchesProject(connectionString)) {
      throw new Error('Database target does not match the confirmed project reference.');
    }
  } catch (error) {
    console.error(`Baseline verification FAILED (${error.message})`);
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString, connectionTimeoutMillis: 12000 });
  const failures = [];

  try {
    await client.connect();
    const identity = await client.query(
      'select current_user, current_database()'
    );
    if (identity.rows[0]?.current_user !== 'postgres') {
      failures.push('Connected database role is not postgres.');
    }

    const functions = await client.query(
      `select expected.signature,
              to_regprocedure(expected.signature) is not null as present
       from unnest($1::text[]) as expected(signature)`,
      [requiredFunctions]
    );
    failures.push(...functions.rows
      .filter(row => !row.present)
      .map(row => `Missing function: ${row.signature}`));

    const expectedRpcs = baselinePhase === 'predeployment'
      ? expectedPreDeploymentRpcs
      : expectedSecuredRpcs;
    const rpcState = await client.query(
      `select expected.signature,
              pg_get_functiondef(p.oid) as definition,
              p.prosecdef as security_definer,
              pg_get_userbyid(p.proowner) as owner,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
              exists (
                select 1
                from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
              ) as public_execute
       from unnest($1::text[]) as expected(signature)
       left join pg_proc p on p.oid = to_regprocedure(expected.signature)`,
      [expectedRpcs.map(rpc => rpc.signature)]
    );
    const rpcExpectations = new Map(
      expectedRpcs.map(rpc => [rpc.signature, rpc])
    );
    failures.push(...rpcState.rows
      .filter(row => !row.definition
        || crypto.createHash('sha256').update(row.definition).digest('hex')
          !== rpcExpectations.get(row.signature).sha256
        || row.security_definer !== rpcExpectations.get(row.signature).securityDefiner
        || row.owner !== 'postgres'
        || row.anon_execute !== rpcExpectations.get(row.signature).anonExecute
        || row.public_execute !== rpcExpectations.get(row.signature).publicExecute
        || row.authenticated_execute !== rpcExpectations.get(row.signature).authenticatedExecute
        || row.service_execute !== rpcExpectations.get(row.signature).serviceExecute)
      .map(row => `RPC fingerprint/security state differs from ${baselinePhase} expectation: ${row.signature}`));

    const tables = await client.query(
      `      select expected.name,
             c.oid is not null and c.relkind in ('r', 'p') as present,
              coalesce(c.relrowsecurity, false) as rls_enabled
       from unnest($1::text[]) as expected(name)
       left join pg_class c
         on c.oid = to_regclass('public.' || expected.name)`,
      [requiredTables]
    );
    failures.push(...tables.rows
      .filter(row => !row.present)
      .map(row => `Missing table: public.${row.name}`));

    const rlsTables = new Set([
      'lead_notes',
      'lead_archives',
      'crm_export_jobs',
      'crm_products',
      'crm_price_books',
      'crm_price_book_entries',
      'crm_opportunity_line_items',
      'crm_quotes',
      'crm_quote_line_items',
      'crm_quote_revisions',
    ]);
    failures.push(...tables.rows
      .filter(row => rlsTables.has(row.name) && !row.rls_enabled)
      .map(row => `RLS is not enabled on public.${row.name}`));

    const indexes = await client.query(
      `select expected.name, coalesce(i.indisvalid, false) as valid
       from unnest($1::text[]) as expected(name)
       left join pg_class c on c.relname = expected.name
       left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       left join pg_index i on i.indexrelid = c.oid and n.oid is not null`,
      [requiredIndexes]
    );
    failures.push(...indexes.rows
      .filter(row => !row.valid)
      .map(row => `Missing or invalid index: public.${row.name}`));

    const policies = await client.query(
      `select expected.name, p.policyname is not null as present
       from unnest($1::text[], $2::text[], $3::text[])
         as expected(name, schema_name, table_name)
       left join pg_policies p
         on p.policyname = expected.name
        and p.schemaname = expected.schema_name
        and p.tablename = expected.table_name`,
      [
        requiredPolicies.map(([name]) => name),
        requiredPolicies.map(([, schema]) => schema),
        requiredPolicies.map(([, , table]) => table),
      ]
    );
    failures.push(...policies.rows
      .filter(row => !row.present)
      .map(row => `Missing policy: ${row.name}`));

    const constraints = await client.query(
      `select expected.name, c.conname is not null as present
       from unnest($1::text[]) as expected(name)
       left join pg_constraint c
         on c.conname = expected.name
        and c.conrelid = to_regclass('public.crm_export_jobs')`,
      [requiredConstraints]
    );
    failures.push(...constraints.rows
      .filter(row => !row.present)
      .map(row => `Missing constraint: ${row.name}`));

    const exportGrants = await client.query(`
      select has_table_privilege('authenticated', 'public.crm_export_jobs', 'SELECT') as can_select,
             has_table_privilege('authenticated', 'public.crm_export_jobs', 'INSERT') as table_insert,
             has_table_privilege('authenticated', 'public.crm_export_jobs', 'UPDATE') as table_update,
             has_table_privilege('authenticated', 'public.crm_export_jobs', 'DELETE') as table_delete,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'module', 'INSERT') as insert_module,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'columns', 'INSERT') as insert_columns,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'time_zone', 'INSERT') as insert_time_zone,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'status', 'INSERT') as insert_status,
             has_column_privilege('authenticated', 'public.crm_export_jobs', 'status', 'UPDATE') as update_status
    `);
    const exportGrantState = exportGrants.rows[0];
    const exportGrantStateHasUnexpectedGrants = !exportGrantState.can_select
      || exportGrantState.table_insert
      || exportGrantState.table_update
      || exportGrantState.table_delete
      || !exportGrantState.insert_module
      || !exportGrantState.insert_columns
      || !exportGrantState.insert_time_zone
      || exportGrantState.insert_status
      || exportGrantState.update_status;
    const exportGrantStateIsKnownPreFix = exportGrantState.can_select
      && exportGrantState.table_insert
      && exportGrantState.table_update
      && exportGrantState.table_delete
      && exportGrantState.insert_status
      && exportGrantState.update_status;
    if (baselinePhase === 'after-rpc-security') {
      if (!exportGrantStateIsKnownPreFix) {
        failures.push('crm_export_jobs grants differ from the documented pending pre-fix state.');
      }
    } else if (exportGrantStateHasUnexpectedGrants) {
      failures.push('crm_export_jobs authenticated grants exceed the migration’s column-scoped insert/select contract.');
    }

    const triggers = await client.query(
      `select expected.name,
              t.tgname is not null and c.oid is not null and n.oid is not null and f.oid is not null as compatible
       from unnest($1::text[], $2::text[], $3::text[])
         as expected(name, table_name, function_name)
       left join pg_trigger t
         on t.tgname = expected.name
        and not t.tgisinternal
       left join pg_class c
         on c.oid = t.tgrelid
        and c.relname = expected.table_name
       left join pg_namespace n
         on n.oid = c.relnamespace
        and n.nspname = 'public'
       left join pg_proc f
         on f.oid = t.tgfoid
        and f.proname = expected.function_name`,
      [
        requiredTriggers.map(([name]) => name),
        requiredTriggers.map(([, table]) => table),
        requiredTriggers.map(([, , fn]) => fn),
      ]
    );
    failures.push(...triggers.rows
      .filter(row => !row.compatible)
      .map(row => `Missing or incompatible trigger: ${row.name}`));

    const columns = await client.query(
      `select expected.table_name, expected.column_name,
              actual.column_name is not null as present
       from unnest($1::text[], $2::text[]) as expected(table_name, column_name)
       left join information_schema.columns actual
         on actual.table_schema = 'public'
        and actual.table_name = expected.table_name
        and actual.column_name = expected.column_name`,
      [requiredColumns.map(([table]) => table), requiredColumns.map(([, column]) => column)]
    );
    failures.push(...columns.rows
      .filter(row => !row.present)
      .map(row => `Missing column: public.${row.table_name}.${row.column_name}`));

    const roles = await client.query(
      `select expected.name, r.rolname is not null as present,
              coalesce(r.rolcanlogin, true) as can_login,
              coalesce(r.rolbypassrls, true) as bypasses_rls
       from unnest($1::text[]) as expected(name)
       left join pg_roles r on r.rolname = expected.name`,
      [['crm_masked_reader', 'crm_import_executor']]
    );
    failures.push(...roles.rows
      .filter(row => !row.present || row.can_login || row.bypasses_rls)
      .map(row => `Role is missing or unsafe: ${row.name}`));

    const readableViews = await client.query(
      `      select expected.name, c.relname is not null and c.relkind = 'v' as present,
              pg_get_userbyid(c.relowner) as owner
       from unnest($1::text[]) as expected(name)
       left join pg_class c on c.oid = to_regclass('public.' || expected.name)`,
      [['accounts_readable', 'contacts_readable', 'opportunities_readable', 'campaigns_readable']]
    );
    failures.push(...readableViews.rows
      .filter(row => !row.present || row.owner !== 'crm_masked_reader')
      .map(row => `Readable view is missing or has an unexpected owner: ${row.name}`));

    const bucket = await client.query(
      `select b.id, not b.public as private
       from storage.buckets b
       where b.id = 'crm-export-jobs'`
    );
    if (bucket.rowCount !== 1 || !bucket.rows[0].private) {
      failures.push('Private storage bucket crm-export-jobs is missing or public.');
    }

    const receipts = await client.query(
      `select version, count(*)::integer as count
       from supabase_migrations.schema_migrations
       where version = any($1::text[])
       group by version`,
      [expectedReceipts]
    );
    const receiptCounts = new Map(receipts.rows.map(row => [row.version, row.count]));
    failures.push(...expectedReceipts
      .filter(version => receiptCounts.get(version) !== 1)
      .map(version => `Expected exactly one ledger receipt for ${version}.`));

    const forbidden = await client.query(
      `select version
       from supabase_migrations.schema_migrations
       where version = any($1::text[])
       order by version`,
      [unappliedReceipts]
    );
    failures.push(...forbidden.rows
      .map(row => `Unexpected receipt for a forward migration intentionally kept outside the ledger: ${row.version}.`));

    if (failures.length) {
      console.error(`Schema baseline FAILED (${failures.length} issue(s)):`);
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Schema baseline PASS for database ${identity.rows[0].current_database} (${baselinePhase}).`);
    console.log('Read-only checks confirmed required object signatures, RLS, indexes, policies, roles, views, storage bucket, and migration receipt state.');
    if (baselinePhase === 'predeployment') {
      console.log('Predeployment baseline only; this is not production approval.');
    } else if (baselinePhase === 'after-rpc-security') {
      console.log('Pending known P1: authenticated crm_export_jobs table-level DML; apply the separate forward ACL migration next.');
    } else {
      console.log('Final structural/security baseline passed; this does not certify production readiness or 100k-lead performance.');
    }
  } catch (error) {
    console.error(`Schema baseline FAILED (${error.code || 'DATABASE_OR_VALIDATION_ERROR'}).`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
