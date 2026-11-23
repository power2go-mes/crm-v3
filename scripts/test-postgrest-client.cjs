process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const envContent = fs.readFileSync('apps/web/.env.local', 'utf8');
const urlLine = envContent.split(/\r?\n/).find(v => /^NEXT_PUBLIC_SUPABASE_URL\s*=/.test(v));
const anonLine = envContent.split(/\r?\n/).find(v => /^NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=/.test(v));
const dbLine = envContent.split(/\r?\n/).find(v => /^DATABASE_URL\s*=/.test(v));

const supabaseUrl = urlLine.slice(urlLine.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
const anonKey = anonLine.slice(anonLine.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
const connectionString = dbLine.slice(dbLine.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

const creds = JSON.parse(fs.readFileSync('.test-credentials.local.json', 'utf8'));

async function testWithRealUsers() {
  const pgClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  console.log('Connected to PG');

  // Sign in as Super Admin
  const adminClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const adminAuth = await adminClient.auth.signInWithPassword({
    email: 'test.superadmin@finlonexa.test',
    password: creds['test.superadmin@finlonexa.test']
  });
  console.log('Admin login status:', adminAuth.error ? adminAuth.error.message : 'SUCCESS (user: ' + adminAuth.data.user.id + ')');

  // Sign in as BDO1
  const bdoClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const bdoAuth = await bdoClient.auth.signInWithPassword({
    email: 'test.bdo1@finlonexa.test',
    password: creds['test.bdo1@finlonexa.test']
  });
  console.log('BDO login status:', bdoAuth.error ? bdoAuth.error.message : 'SUCCESS (user: ' + bdoAuth.data.user.id + ')');

  // Apply dashboard_home_metrics fix and read_module_records in DB
  await pgClient.query(`
    CREATE OR REPLACE FUNCTION public.dashboard_home_metrics(date_from date default null, date_to date default null)
    RETURNS jsonb
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
      item record;
      stats jsonb := '[]'::jsonb;
      charts jsonb := '[]'::jsonb;
      groups jsonb;
      n bigint;
      clause text;
    BEGIN
      IF NOT public.has_effective_permission(auth.uid(), 'dashboard.view') THEN
        RAISE EXCEPTION 'Dashboard denied' USING errcode = '42501';
      END IF;

      IF date_from > date_to THEN
        RAISE EXCEPTION 'Invalid date range';
      END IF;

      FOR item IN SELECT * FROM (VALUES
        ('accounts', 'Total Accounts'),
        ('campaigns', 'Total Campaigns'),
        ('contacts', 'Total Contacts'),
        ('leads', 'Total Leads'),
        ('opportunities', 'Total Opportunities')
      ) v(tbl, label) LOOP
        IF public.has_effective_permission(auth.uid(), item.tbl || '.view') AND to_regclass('public.' || item.tbl) IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace ns ON ns.oid = c.relnamespace
            WHERE ns.nspname = 'public' AND c.relname = item.tbl AND c.relrowsecurity
          ) THEN
            RAISE EXCEPTION 'Unscoped metric source';
          END IF;

          clause := CASE WHEN item.tbl = 'leads' THEN ' AND NOT is_convert' ELSE '' END;
          EXECUTE format(
            'SELECT count(id) FROM public.%I WHERE ($1 IS NULL OR created_at >= $1::timestamptz) AND ($2 IS NULL OR created_at < ($2+1)::timestamptz)' || clause,
            item.tbl
          ) INTO n USING date_from, date_to;

          stats := stats || jsonb_build_array(jsonb_build_object('title', item.label, 'value', n));
        END IF;
      END LOOP;

      FOR item IN SELECT * FROM (VALUES
        ('leads', 'lead_source', 'Leads by Source', 'funnel'),
        ('leads', 'status', 'Leads by Stage', 'bar'),
        ('accounts', 'account_type', 'Accounts by Account Type', 'pie'),
        ('campaigns', 'campaign_type', 'Campaigns by Type', 'donut'),
        ('opportunities', 'lead_source', 'Opportunities by Lead Source', 'bar')
      ) v(tbl, col, title, kind) LOOP
        IF public.has_effective_permission(auth.uid(), item.tbl || '.view') THEN
          IF EXISTS (SELECT 1 FROM public.crm_field_definitions d WHERE d.module = item.tbl AND d.key = item.col)
             AND NOT EXISTS (
               SELECT 1 FROM public.crm_field_definitions d
               WHERE d.module = item.tbl AND d.key = item.col AND public.crm_shared_field_access(d.id)
             ) THEN
            CONTINUE;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = item.tbl AND column_name = item.col
          ) THEN
            charts := charts || jsonb_build_array(jsonb_build_object('id', item.tbl || '.' || item.col, 'title', item.title, 'kind', item.kind, 'status', 'schema_missing', 'data', '[]'::jsonb));
          ELSE
            IF NOT EXISTS (
              SELECT 1 FROM pg_class c
              JOIN pg_namespace ns ON ns.oid = c.relnamespace
              WHERE ns.nspname = 'public' AND c.relname = item.tbl AND c.relrowsecurity
            ) THEN
              RAISE EXCEPTION 'Unscoped chart source';
            END IF;

            IF item.tbl = 'leads' AND item.col = 'status' THEN
              SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) INTO groups FROM (
                SELECT coalesce(s.name, 'No stage') label, count(l.id) value
                FROM public.leads l
                LEFT JOIN public.lead_statuses s ON s.id = l.status
                WHERE NOT l.is_convert
                  AND (date_from IS NULL OR l.created_at >= date_from::timestamptz)
                  AND (date_to IS NULL OR l.created_at < (date_to + 1)::timestamptz)
                GROUP BY l.status, s.name
                ORDER BY value DESC, label
                LIMIT 200
              ) g;
            ELSE
              clause := CASE WHEN item.tbl = 'leads' THEN ' AND NOT is_convert' ELSE '' END;
              EXECUTE format(
                'SELECT coalesce(jsonb_agg(to_jsonb(g)), ''[]''::jsonb) FROM (SELECT coalesce(nullif(%I::text, ''''), ''Unknown'') label, count(id) value FROM public.%I WHERE ($1 IS NULL OR created_at >= $1::timestamptz) AND ($2 IS NULL OR created_at < ($2+1)::timestamptz)' || clause || ' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 200) g',
                item.col, item.tbl
              ) INTO groups USING date_from, date_to;
            END IF;

            charts := charts || jsonb_build_array(jsonb_build_object('id', item.tbl || '.' || item.col, 'title', item.title, 'kind', item.kind, 'status', 'ready', 'data', groups));
          END IF;
        END IF;
      END LOOP;

      RETURN jsonb_build_object('kpis', stats, 'charts', charts);
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.read_module_records(
      m text,
      rid uuid default null,
      page_number integer default 1,
      page_size integer default 20
    ) RETURNS jsonb
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
      rows jsonb;
      row_data jsonb;
      result jsonb := '[]'::jsonb;
      f record;
    BEGIN
      IF m IS NULL OR page_number IS NULL OR page_size IS NULL 
         OR m NOT IN ('accounts', 'contacts', 'opportunities', 'campaigns')
         OR page_number < 1 OR page_number > 10000 
         OR page_size < 1 OR page_size > 100 THEN
        RAISE EXCEPTION 'Invalid read request';
      END IF;

      IF auth.uid() IS NULL OR NOT public.has_effective_permission(auth.uid(), m || '.view') THEN
        RAISE EXCEPTION 'Read denied' USING errcode = '42501';
      END IF;

      EXECUTE format(
        'SELECT coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE ($1 IS NULL OR id = $1) ORDER BY id LIMIT $2 OFFSET $3) r',
        m
      ) INTO rows USING rid, page_size, (page_number - 1) * page_size;

      FOR row_data IN SELECT value FROM jsonb_array_elements(rows) LOOP
        FOR f IN SELECT id, key FROM public.crm_field_definitions WHERE module = m LOOP
          IF NOT public.crm_shared_field_access(f.id) THEN
            row_data := row_data - f.key;
          END IF;
        END LOOP;
        result := result || jsonb_build_array(row_data);
      END LOOP;

      RETURN result;
    END;
    $$;

    GRANT CREATE ON SCHEMA public TO crm_masked_reader;
    ALTER FUNCTION public.dashboard_home_metrics(date, date) OWNER TO crm_masked_reader;
    ALTER FUNCTION public.read_module_records(text, uuid, integer, integer) OWNER TO crm_masked_reader;
    REVOKE CREATE ON SCHEMA public FROM crm_masked_reader;

    REVOKE ALL ON FUNCTION public.dashboard_home_metrics(date, date) FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.dashboard_home_metrics(date, date) TO authenticated;

    REVOKE ALL ON FUNCTION public.read_module_records(text, uuid, integer, integer) FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.read_module_records(text, uuid, integer, integer) TO authenticated;

    NOTIFY pgrst, 'reload schema';
  `);

  console.log('Reloaded schema cache, waiting 1s...');
  await new Promise(r => setTimeout(r, 1000));

  // 1. Direct raw SELECT of protected column as BDO
  const bdoDirectLeadSource = await bdoClient.from('opportunities').select('id, lead_source').limit(1);
  console.log('1. BDO direct raw SELECT opportunities(lead_source):', bdoDirectLeadSource.error ? 'BLOCKED/DENIED (code: ' + bdoDirectLeadSource.error.code + ', ' + bdoDirectLeadSource.error.message + ')' : 'UNEXPECTED SUCCESS');

  const bdoDirectAccountType = await bdoClient.from('accounts').select('id, account_type').limit(1);
  console.log('2. BDO direct raw SELECT accounts(account_type):', bdoDirectAccountType.error ? 'BLOCKED/DENIED (code: ' + bdoDirectAccountType.error.code + ', ' + bdoDirectAccountType.error.message + ')' : 'UNEXPECTED SUCCESS');

  // 2. Direct raw SELECT of permitted columns as BDO
  const bdoDirectPermitted = await bdoClient.from('opportunities').select('id, name, stage, amount').limit(1);
  console.log('3. BDO direct raw SELECT opportunities(id, name, stage, amount):', bdoDirectPermitted.error ? 'ERROR: ' + bdoDirectPermitted.error.message : 'SUCCESS (records: ' + bdoDirectPermitted.data?.length + ')');

  // 3. Query readable views
  const adminOppsView = await adminClient.from('opportunities_readable').select('id, name, stage, amount, lead_source').limit(3);
  console.log('4. Admin SELECT opportunities_readable:', adminOppsView.error ? 'ERROR: ' + adminOppsView.error.message : 'SUCCESS (records: ' + adminOppsView.data?.length + ')');
  if (adminOppsView.data && adminOppsView.data[0]) {
    console.log('   Sample Admin record lead_source:', adminOppsView.data[0].lead_source);
  }

  const bdoOppsView = await bdoClient.from('opportunities_readable').select('id, name, stage, amount, lead_source').limit(3);
  console.log('5. BDO SELECT opportunities_readable:', bdoOppsView.error ? 'ERROR: ' + bdoOppsView.error.message : 'SUCCESS (records: ' + bdoOppsView.data?.length + ')');
  if (bdoOppsView.data && bdoOppsView.data[0]) {
    console.log('   Sample BDO record lead_source:', bdoOppsView.data[0].lead_source);
  }

  // 4. Test read_module_records RPC
  const adminRpc = await adminClient.rpc('read_module_records', { m: 'opportunities', rid: null, page_number: 1, page_size: 3 });
  console.log('6. Admin RPC read_module_records:', adminRpc.error ? 'ERROR: ' + adminRpc.error.message : 'SUCCESS (records: ' + adminRpc.data?.length + ')');
  if (adminRpc.data && adminRpc.data[0]) {
    console.log('   Admin RPC record has lead_source key?', 'lead_source' in adminRpc.data[0]);
  }

  const bdoRpc = await bdoClient.rpc('read_module_records', { m: 'opportunities', rid: null, page_number: 1, page_size: 3 });
  console.log('7. BDO RPC read_module_records:', bdoRpc.error ? 'ERROR: ' + bdoRpc.error.message : 'SUCCESS (records: ' + bdoRpc.data?.length + ')');
  if (bdoRpc.data && bdoRpc.data[0]) {
    console.log('   BDO RPC record has lead_source key?', 'lead_source' in bdoRpc.data[0]);
  }

  // 5. Test dashboard_home_metrics
  const adminDash = await adminClient.rpc('dashboard_home_metrics');
  console.log('8. Admin RPC dashboard_home_metrics:', adminDash.error ? 'ERROR: ' + adminDash.error.message : 'SUCCESS (KPIs: ' + adminDash.data?.kpis?.length + ', Charts: ' + adminDash.data?.charts?.length + ')');

  const bdoDash = await bdoClient.rpc('dashboard_home_metrics');
  console.log('9. BDO RPC dashboard_home_metrics:', bdoDash.error ? 'ERROR: ' + bdoDash.error.message : 'SUCCESS (KPIs: ' + bdoDash.data?.kpis?.length + ', Charts: ' + bdoDash.data?.charts?.length + ')');

  // 5. Hide lead_source for BDO
  const oppFieldDef = await pgClient.query("SELECT id FROM public.crm_field_definitions WHERE module = 'opportunities' AND key = 'lead_source'");
  const fieldDefId = oppFieldDef.rows[0].id;

  await pgClient.query(`
    INSERT INTO public.crm_field_rules (definition_id, role_id, visible, editable)
    VALUES ($1, 'BDO', false, false)
    ON CONFLICT (definition_id, role_id) DO UPDATE SET visible = false, editable = false
  `, [fieldDefId]);

  console.log('\n--- TESTING WITH HIDDEN FIELD RULE FOR BDO ---');

  // Admin query readable view on deal with lead_source
  const bdoOpp = await pgClient.query(`
    INSERT INTO public.opportunities (name, stage, amount, probability, close_date, owner_id, lead_source)
    VALUES ('BDO Secret Source Deal', 'Qualification', 15000, 20, CURRENT_DATE + 30, $1, 'website')
    RETURNING id
  `, [bdoAuth.data.user.id]);
  const bdoOppId = bdoOpp.rows[0].id;

  const adminViewRes = await adminClient.from('opportunities_readable').select('id, name, lead_source').eq('id', bdoOppId).single();
  console.log('11. Admin view query on BDO deal:', adminViewRes.data?.lead_source === 'website' ? 'SUCCESS (lead_source: website)' : 'FAILED: ' + adminViewRes.data?.lead_source);

  const bdoViewRes = await bdoClient.from('opportunities_readable').select('id, name, lead_source').eq('id', bdoOppId).single();
  console.log('12. BDO view query on BDO deal (hidden):', bdoViewRes.data?.lead_source === null ? 'SUCCESS (lead_source: null - MASKED)' : 'FAILED: ' + bdoViewRes.data?.lead_source);

  const adminRpcRes = await adminClient.rpc('read_module_records', { m: 'opportunities', rid: bdoOppId, page_number: 1, page_size: 1 });
  console.log('13. Admin RPC query on BDO deal:', adminRpcRes.data[0]?.lead_source === 'website' ? 'SUCCESS (key present: website)' : 'FAILED');

  const bdoRpcRes = await bdoClient.rpc('read_module_records', { m: 'opportunities', rid: bdoOppId, page_number: 1, page_size: 1 });
  console.log('14. BDO RPC query on BDO deal (hidden):', !('lead_source' in bdoRpcRes.data[0]) ? 'SUCCESS (lead_source key STRIPPED)' : 'FAILED (leaked: ' + bdoRpcRes.data[0]?.lead_source + ')');

  const bdoDashHidden = await bdoClient.rpc('dashboard_home_metrics');
  const bdoOppChart = bdoDashHidden.data?.charts?.find(c => c.id === 'opportunities.lead_source');
  console.log('15. BDO dashboard chart for hidden lead_source:', bdoOppChart === undefined ? 'SUCCESS (chart omitted from dashboard)' : 'FAILED (chart present)');

  const adminDashHidden = await adminClient.rpc('dashboard_home_metrics');
  const adminOppChart = adminDashHidden.data?.charts?.find(c => c.id === 'opportunities.lead_source');
  console.log('16. Admin dashboard chart for lead_source:', adminOppChart !== undefined ? 'SUCCESS (chart present for admin)' : 'FAILED (chart missing)');

  // Clean up test rule & deal
  await pgClient.query(`DELETE FROM public.crm_field_rules WHERE definition_id = $1 AND role_id = 'BDO'`, [fieldDefId]);
  await pgClient.query(`DELETE FROM public.opportunities WHERE id = $1`, [bdoOppId]);

  await pgClient.end();
}

testWithRealUsers().catch(console.error);
