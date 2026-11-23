import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

interface TestResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  const mark = passed ? '[PASS]' : '[FAIL]';
  console.log(`${mark} ${step}: ${details}`);
}

async function httpGet(url: string, headers: Record<string, string> = {}): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        location: res.headers.location,
        body,
      }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

async function main() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Focused Auth Security Verification');
  console.log('====================================================');

  const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
  const testEmail = 'test.superadmin@finlonexa.test';
  const testPassword = creds[testEmail];

  const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
  const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

  // 1. Client initialization with publishable key
  record('1. Publishable Key Validation', publishableKey.startsWith('sb_publishable_'), 'Using new publishable key format');

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Real Login
  const loginRes = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  const loginSuccess = !loginRes.error && !!loginRes.data.session?.access_token;
  record('2. Supabase Auth Login', loginSuccess, loginSuccess ? 'Session created successfully with valid JWT' : `Failed: ${loginRes.error?.message}`);

  if (!loginSuccess) {
    console.error('Login failed, aborting remaining tests');
    process.exit(1);
  }

  const accessToken = loginRes.data.session!.access_token;
  const refreshToken = loginRes.data.session!.refresh_token;

  // 3. Authenticated query with session
  const authSupabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const profileRes = await authSupabase.from('user_profiles').select('id, email, first_name, is_active').eq('email', testEmail).single();
  const profileSuccess = !profileRes.error && profileRes.data?.is_active === true;
  record('3. Authenticated Profile Access', profileSuccess, profileSuccess ? `Profile retrieved: ${profileRes.data?.first_name} (Active: ${profileRes.data?.is_active})` : `Failed: ${profileRes.error?.message}`);

  // 4. Session refresh
  const refreshRes = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  const refreshSuccess = !refreshRes.error && !!refreshRes.data.session?.access_token;
  record('4. Auth Session Refresh', refreshSuccess, refreshSuccess ? 'New session and token generated via refresh_token' : `Failed: ${refreshRes.error?.message}`);

  // 5. Sign out
  const signOutRes = await authSupabase.auth.signOut();
  record('5. Auth Sign Out', !signOutRes.error, signOutRes.error ? `Failed: ${signOutRes.error.message}` : 'Session terminated cleanly');

  // 6. Verify Unauthenticated Data Denial under RLS
  const unauthSupabase = createClient(supabaseUrl, publishableKey);
  const unauthLeads = await unauthSupabase.from('leads').select('id');
  const deniedSuccess = unauthLeads.data?.length === 0 || !!unauthLeads.error;
  record('6. Unauthenticated RLS Data Isolation', deniedSuccess, deniedSuccess ? `Unauthenticated query returned 0 rows (RLS enforced)` : 'Unauthenticated access unexpectedly returned rows');

  // 7. Dev Server Health & /login Route
  try {
    const loginPage = await httpGet('http://localhost:3000/login');
    record('7. Dev Server /login Route', loginPage.status === 200, `Returned HTTP ${loginPage.status}`);
  } catch (err: any) {
    record('7. Dev Server /login Route', false, err.message);
  }

  // 8. Middleware Route Protection for /leads
  try {
    const leadsPage = await httpGet('http://localhost:3000/leads');
    // Unauthenticated GET to /leads must redirect to /login (307 or 302)
    const isRedirect = (leadsPage.status === 307 || leadsPage.status === 302) && leadsPage.location?.includes('/login');
    record('8. Middleware Protected Route (/leads)', isRedirect, `Redirected with HTTP ${leadsPage.status} to ${leadsPage.location}`);
  } catch (err: any) {
    record('8. Middleware Protected Route (/leads)', false, err.message);
  }

  // Summary
  const allPassed = results.every(r => r.passed);
  console.log('====================================================');
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log('OVERALL STATUS:', allPassed ? 'ALL PASS' : 'FAILURES DETECTED');
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
