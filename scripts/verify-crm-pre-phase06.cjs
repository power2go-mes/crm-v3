const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = Object.fromEntries(
  fs.readFileSync('apps/web/.env.local', 'utf-8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')];
    })
);

const creds = JSON.parse(fs.readFileSync('.test-credentials.local.json', 'utf-8'));

async function verifyAll() {
  console.log('=== FINLONEXA CRM v3 PRE-PHASE 06 COMPREHENSIVE VERIFICATION ===\n');

  // Test roles
  const rolesToTest = [
    { role: 'SUPER_ADMIN', email: 'test.superadmin@finlonexa.test' },
    { role: 'HEAD_OF_SALES', email: 'test.headofsales@finlonexa.test' },
    { role: 'RSM (North)', email: 'test.rsm1@finlonexa.test' },
    { role: 'SSM (North)', email: 'test.ssm1@finlonexa.test' },
    { role: 'ASM (North)', email: 'test.asm1@finlonexa.test' },
    { role: 'BDO (North)', email: 'test.bdo1@finlonexa.test' },
    { role: 'BDO (South)', email: 'test.bdo3@finlonexa.test' },
  ];

  for (const { role, email } of rolesToTest) {
    console.log(`\n--- Testing Role: ${role} (${email}) ---`);
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password: creds[email]
    });

    if (authErr) {
      console.error(`  Auth failed: ${authErr.message}`);
      continue;
    }

    const userId = auth.user.id;

    // 1. Dashboard Metrics
    const metricsRes = await supabase.rpc('dashboard_home_metrics', { date_from: null, date_to: null });
    if (metricsRes.error) {
      console.log(`  [DASHBOARD METRICS] Error: ${metricsRes.error.message}`);
    } else {
      const kpis = metricsRes.data.kpis.map(k => `${k.title}: ${k.value}`).join(', ');
      console.log(`  [DASHBOARD METRICS] OK: ${kpis}`);
    }

    // 2. Dashboard Table Widgets (Accounts, Contacts, Campaigns, Won Leads, Won Opps)
    const widgets = ['accounts', 'contacts', 'campaigns', 'won-leads', 'won-opportunities'];
    for (const w of widgets) {
      const tableRes = await supabase.rpc('dashboard_home_table_page', { widget: w, page_number: 1 });
      if (tableRes.error) {
        console.log(`  [TABLE WIDGET ${w}] Error: ${tableRes.error.message}`);
      } else {
        console.log(`  [TABLE WIDGET ${w}] OK - total: ${tableRes.data.total_count}, returned rows: ${tableRes.data.rows.length}, missing cols: ${tableRes.data.missing.length}`);
      }
    }

    // 3. Module Tables via RLS
    const accRes = await supabase.from('accounts').select('id', { count: 'exact', head: true });
    const conRes = await supabase.from('contacts').select('id', { count: 'exact', head: true });
    const leadRes = await supabase.from('leads').select('id', { count: 'exact', head: true });
    const oppRes = await supabase.from('opportunities').select('id', { count: 'exact', head: true });
    console.log(`  [DIRECT RLS TABLES] Accounts: ${accRes.count ?? accRes.error?.message}, Contacts: ${conRes.count ?? conRes.error?.message}, Leads: ${leadRes.count ?? leadRes.error?.message}, Opportunities: ${oppRes.count ?? oppRes.error?.message}`);

    // 4. Lead Stages & Assignment Rules Permissions
    const stageRes = await supabase.from('lead_statuses').select('*');
    const rulesRes = await supabase.from('crm_lead_assignment_rules').select('*');
    console.log(`  [CONFIG ACCESS] Lead Stages: ${stageRes.data ? stageRes.data.length + ' stages' : 'ERR: ' + stageRes.error.message}, Assignment Rules: ${rulesRes.data ? rulesRes.data.length + ' rules' : 'ERR: ' + rulesRes.error.message}`);
  }

  console.log('\n=== COMPREHENSIVE VERIFICATION COMPLETE ===');
}

verifyAll();
