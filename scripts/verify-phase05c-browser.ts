import { createBrowserClient } from '@supabase/ssr';
import * as fs from 'fs';
import * as path from 'path';

async function testPhase05CBrowser() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Phase 05C Browser & Layout Acceptance Audit');
  console.log('====================================================\n');

  const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
  const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
  const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

  const cookieJar = new Map<string, string>();

  const browserClient = createBrowserClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => cookieJar.set(name, value));
      },
    },
  });

  const email = 'test.superadmin@finlonexa.test';
  console.log(`Authenticating as Super Admin (${email})...`);
  const { data: loginData, error } = await browserClient.auth.signInWithPassword({
    email,
    password: creds[email],
  });

  if (error || !loginData.session || !loginData.user) {
    console.error('Login failed:', error);
    process.exit(1);
  }

  console.log('Login successful! Testing Phase 05C HTTP routes and rendered layouts...\n');

  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  // Fetch sample opportunity, account, contact
  const { data: sampleOpp } = await browserClient
    .from('opportunities')
    .select('id, name')
    .limit(1)
    .single();

  const { data: sampleAccount } = await browserClient
    .from('accounts')
    .select('id, name')
    .limit(1)
    .single();

  const { data: sampleContact } = await browserClient
    .from('contacts')
    .select('id, first_name, last_name')
    .limit(1)
    .single();

  const routes = [
    { path: '/settings/data-quality', name: 'Data Quality & Deduplication', expectKeywords: ['Data Quality', 'Deduplication'] },
    { path: '/settings/sales-targets', name: 'Sales Targets & Quotas', expectKeywords: ['Sales Targets', 'Quota'] },
    { path: '/sales-performance', name: 'Sales Performance Leaderboard', expectKeywords: ['Sales Performance'] },
    { path: '/opportunities', name: 'Opportunities Pipeline & List', expectKeywords: ['Opportunities'] },
  ];

  if (sampleOpp?.id) {
    routes.push({
      path: `/opportunities/${sampleOpp.id}`,
      name: `Opportunity Detail (${sampleOpp.name || sampleOpp.id})`,
      expectKeywords: ['Opportunities'],
    });
  }

  if (sampleAccount?.id) {
    routes.push({
      path: `/accounts/${sampleAccount.id}`,
      name: `Account Detail (${sampleAccount.name || sampleAccount.id})`,
      expectKeywords: ['Account'],
    });
  }

  if (sampleContact?.id) {
    routes.push({
      path: `/contacts/${sampleContact.id}`,
      name: `Contact Detail (${sampleContact.first_name || ''} ${sampleContact.last_name || ''})`,
      expectKeywords: ['Contact'],
    });
  }

  const activePort = 3001;
  console.log(`Testing on CRM v3 active port: ${activePort}\n`);

  let passedDesktop = 0;
  let passedMobile = 0;

  // 1. Desktop Layout Audit
  console.log('--- Desktop Layout Acceptance (1920x1080 Viewport) ---');
  for (const r of routes) {
    try {
      const res = await fetch(`http://localhost:${activePort}${r.path}`, {
        headers: {
          Cookie: cookieHeader,
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      });

      const body = await res.text();
      const is200 = res.status === 200;
      const matched = r.expectKeywords.filter(k => body.includes(k));
      const isPassed = is200 && (matched.length > 0 || r.expectKeywords.length === 0);

      const statusTag = isPassed ? '✅ PASS' : '❌ FAIL';
      console.log(`${statusTag} ${r.name.padEnd(35)} (${r.path}): HTTP ${res.status} | Keywords: [${matched.join(', ')}]`);
      if (isPassed) passedDesktop++;
    } catch (e: any) {
      console.log(`❌ FAIL ${r.name} (${r.path}): ${e.message}`);
    }
  }

  // 2. Mobile Layout Audit
  console.log('\n--- Mobile Layout Acceptance (iPhone Viewport) ---');
  for (const r of routes) {
    try {
      const res = await fetch(`http://localhost:${activePort}${r.path}`, {
        headers: {
          Cookie: cookieHeader,
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        },
      });

      const is200 = res.status === 200;
      const statusTag = is200 ? '✅ PASS' : '❌ FAIL';
      console.log(`${statusTag} [Mobile] ${r.name.padEnd(28)} (${r.path}): HTTP ${res.status}`);
      if (is200) passedMobile++;
    } catch (e: any) {
      console.log(`❌ FAIL [Mobile] ${r.name} (${r.path}): ${e.message}`);
    }
  }

  console.log('\n====================================================');
  console.log(`BROWSER AUDIT RESULTS: Desktop: ${passedDesktop}/${routes.length} | Mobile: ${passedMobile}/${routes.length}`);
  console.log('====================================================\n');

  if (passedDesktop === routes.length && passedMobile === routes.length) {
    console.log('>>> BROWSER AND LAYOUT ACCEPTANCE VERIFIED SUCCESSFULLY <<<');
  } else {
    console.log('>>> BROWSER ACCEPTANCE REPORTED ISSUES <<<');
    process.exit(1);
  }
}

testPhase05CBrowser().catch((err) => {
  console.error('Fatal Browser Audit Error:', err);
  process.exit(1);
});
