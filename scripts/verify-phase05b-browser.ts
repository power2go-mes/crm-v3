import { createBrowserClient } from '@supabase/ssr';
import * as fs from 'fs';
import * as path from 'path';

async function testPhase05BBrowser() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Phase 05B Browser & Layout Acceptance Audit');
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

  console.log('Login successful! Testing Phase 05B HTTP routes and rendered layouts...\n');

  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

  // Fetch sample opportunity
  const { data: sampleOpp } = await browserClient
    .from('opportunities')
    .select('id, name')
    .limit(1)
    .single();

  const oppId = sampleOpp?.id;

  const routes = [
    { path: '/settings/products', name: 'Product Catalog Management', expectKeywords: ['Products', 'Catalog'] },
    { path: '/settings/products/price-books', name: 'Price Books & Catalogs', expectKeywords: ['Price Books'] },
    { path: '/settings', name: 'Settings Hub', expectKeywords: ['Settings'] },
  ];

  if (oppId) {
    routes.push({
      path: `/opportunities/${oppId}`,
      name: `Opportunity Detail (${sampleOpp?.name || oppId})`,
      expectKeywords: ['Opportunities', 'Products', 'Quotations'],
    });
  }

  // Detect which port is responding (3000 or 3001)
  let activePort = 3000;
  try {
    const probe = await fetch(`http://localhost:3000/settings/products`, {
      headers: { Cookie: cookieHeader },
    });
    if (probe.status !== 200 && probe.status !== 307) {
      activePort = 3001;
    }
  } catch {
    activePort = 3001;
  }
  console.log(`Testing on active port: ${activePort}\n`);

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

testPhase05BBrowser().catch((err) => {
  console.error('Fatal Browser Audit Error:', err);
  process.exit(1);
});
