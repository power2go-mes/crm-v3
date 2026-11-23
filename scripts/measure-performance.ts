import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { createBrowserClient } from '@supabase/ssr';

const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

async function measureRoute(cookieHeader: string, routePath: string): Promise<{
  route: string;
  statusCode: number;
  latencyMs: number;
  payloadBytes: number;
}> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.request(
      `http://localhost:3000${routePath}`,
      {
        method: 'GET',
        headers: {
          Cookie: cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      },
      (res) => {
        let size = 0;
        res.on('data', (chunk) => (size += chunk.length));
        res.on('end', () => {
          const latencyMs = Date.now() - start;
          resolve({
            route: routePath,
            statusCode: res.statusCode || 0,
            latencyMs,
            payloadBytes: size,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runPerformanceAudit() {
  console.log('================================================================');
  console.log('FINLONEXA CRM v3 — PHASE 06 PERFORMANCE & LATENCY MEASUREMENT');
  console.log('================================================================\n');

  // Authenticate
  const cookieJar = new Map<string, string>();
  const client = createBrowserClient(supabaseUrl, publishableKey, {
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
  await client.auth.signInWithPassword({
    email,
    password: creds[email],
  });

  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const routes = [
    '/dashboard',
    '/leads',
    '/accounts',
    '/contacts',
    '/opportunities',
    '/campaigns',
    '/forecast',
    '/reports',
    '/sales-performance',
    '/activities',
  ];

  console.log('Phase 1: Measuring Cold Server Response Latency...');
  const coldResults: any[] = [];
  for (const r of routes) {
    const res = await measureRoute(cookieHeader, r);
    coldResults.push({
      route: r,
      coldStatus: res.statusCode,
      coldLatencyMs: res.latencyMs,
      payloadKB: (res.payloadBytes / 1024).toFixed(1),
    });
  }

  console.log('Phase 2: Measuring Warm Navigation Latency (3 iterations average)...');
  const finalSummary: any[] = [];
  for (const item of coldResults) {
    let totalWarm = 0;
    const trials = 3;
    for (let i = 0; i < trials; i++) {
      const res = await measureRoute(cookieHeader, item.route);
      totalWarm += res.latencyMs;
    }
    const avgWarm = Math.round(totalWarm / trials);
    finalSummary.push({
      route: item.route,
      coldLatencyMs: item.coldLatencyMs,
      warmLatencyAvgMs: avgWarm,
      payloadKB: item.payloadKB,
      efficiencyRating: avgWarm < 300 ? 'EXCELLENT (<300ms)' : avgWarm < 800 ? 'GOOD (<800ms)' : 'FAIR',
    });
  }

  console.table(finalSummary);

  const evidencePath = path.resolve(__dirname, '../docs/test-evidence/browser-p06/performance-benchmark.json');
  fs.writeFileSync(evidencePath, JSON.stringify(finalSummary, null, 2));
  console.log(`\nPerformance benchmark written to: ${evidencePath}`);
}

runPerformanceAudit().catch((e) => {
  console.error('Performance measurement error:', e);
  process.exit(1);
});
