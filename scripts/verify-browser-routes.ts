import { createBrowserClient } from '@supabase/ssr';
import * as fs from 'fs';
import * as path from 'path';

async function testAllRoutes() {
  console.log('====================================================');
  console.log('FINLONEXA CRM v3 — Authenticated Browser HTTP Route Audit (Lists & Detail Views)');
  console.log('====================================================');

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
  console.log(`Authenticating as ${email}...`);
  const { data: loginData, error } = await browserClient.auth.signInWithPassword({
    email,
    password: creds[email],
  });

  if (error || !loginData.session || !loginData.user) {
    console.error('Login failed:', error);
    process.exit(1);
  }

  const userId = loginData.user.id;
  console.log('Login successful! Auth cookies generated:', Array.from(cookieJar.keys()));

  // Format cookie string for HTTP requests
  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

  // Fetch sample IDs for core records
  const [
    { data: sampleLead },
    { data: sampleAccount },
    { data: sampleContact },
    { data: sampleOpp },
    { data: sampleCampaign },
  ] = await Promise.all([
    browserClient.from('leads').select('id').limit(1).maybeSingle(),
    browserClient.from('accounts').select('id').limit(1).maybeSingle(),
    browserClient.from('contacts').select('id').limit(1).maybeSingle(),
    browserClient.from('opportunities').select('id').limit(1).maybeSingle(),
    browserClient.from('campaigns').select('id').limit(1).maybeSingle(),
  ]);

  // Create temporary task, call, meeting in activities table for detail verification
  const { data: tempTask } = await browserClient.from('activities').insert({
    activity_type: 'task',
    subject: 'Audit Detail Task',
    status: 'not_started',
    priority: 'medium',
    due_date: new Date(Date.now() + 86400000).toISOString(),
    assigned_to_id: userId,
    created_by_id: userId,
  }).select('id').single();

  const { data: tempCall } = await browserClient.from('activities').insert({
    activity_type: 'log_call',
    subject: 'Audit Detail Call',
    status: 'completed',
    priority: 'medium',
    call_type: 'outbound',
    call_duration_minutes: 15,
    start_time: new Date().toISOString(),
    assigned_to_id: userId,
    created_by_id: userId,
  }).select('id').single();

  const { data: tempMeeting } = await browserClient.from('activities').insert({
    activity_type: 'meeting',
    subject: 'Audit Detail Meeting',
    status: 'not_started',
    priority: 'medium',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 1800000).toISOString(),
    assigned_to_id: userId,
    created_by_id: userId,
  }).select('id').single();

  const routes = [
    { path: '/', name: 'Dashboard' },
    { path: '/leads', name: 'Leads List' },
    { path: '/campaigns', name: 'Campaigns List' },
    { path: '/opportunities', name: 'Opportunities List' },
    { path: '/forecast', name: 'Sales Forecast' },
    { path: '/accounts', name: 'Accounts List' },
    { path: '/contacts', name: 'Contacts List' },
    { path: '/reports', name: 'Reports Overview' },
    { path: '/dashboards', name: 'Dashboards Manager' },
    { path: '/calendar', name: 'Schedule Calendar' },
    { path: '/activities', name: 'Unified Activities' },
    { path: '/my-jobs', name: 'My Jobs Queue' },
    { path: '/tasks', name: 'Tasks List' },
    { path: '/calls', name: 'Calls List' },
    { path: '/meetings', name: 'Meetings List' },
    { path: '/sales-performance', name: 'Sales Performance' },
    { path: '/users', name: 'User Management' },
    { path: '/settings', name: 'Company Settings' },
    { path: '/settings/roles', name: 'Roles & Permissions' },
  ];

  if (sampleLead?.id) routes.push({ path: `/leads/${sampleLead.id}`, name: 'Lead Detail View' });
  if (sampleAccount?.id) routes.push({ path: `/accounts/${sampleAccount.id}`, name: 'Account Detail View' });
  if (sampleContact?.id) routes.push({ path: `/contacts/${sampleContact.id}`, name: 'Contact Detail View' });
  if (sampleOpp?.id) routes.push({ path: `/opportunities/${sampleOpp.id}`, name: 'Opportunity Detail View' });
  if (sampleCampaign?.id) routes.push({ path: `/campaigns/${sampleCampaign.id}`, name: 'Campaign Detail View' });
  if (tempTask?.id) routes.push({ path: `/tasks/${tempTask.id}`, name: 'Task Detail View' });
  if (tempCall?.id) routes.push({ path: `/calls/${tempCall.id}`, name: 'Call Detail View' });
  if (tempMeeting?.id) routes.push({ path: `/meetings/${tempMeeting.id}`, name: 'Meeting Detail View' });

  let successCount = 0;

  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route.path}`, {
        headers: {
          Cookie: cookieHeader,
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
      });

      const isOk = res.status === 200;
      const statusDesc = isOk ? '[PASS]' : '[FAIL]';
      const redirectLoc = res.headers.get('location') ? ` -> Redirects to ${res.headers.get('location')}` : '';

      console.log(`${statusDesc} ${route.name.padEnd(25)} (${route.path}): HTTP ${res.status}${redirectLoc}`);

      if (isOk) {
        successCount++;
      }
    } catch (e: any) {
      console.log(`[FAIL] ${route.name} (${route.path}): Request error ${e.message}`);
    }
  }

  // Cleanup temporary activity records
  if (tempTask?.id) await browserClient.from('activities').delete().eq('id', tempTask.id);
  if (tempCall?.id) await browserClient.from('activities').delete().eq('id', tempCall.id);
  if (tempMeeting?.id) await browserClient.from('activities').delete().eq('id', tempMeeting.id);

  console.log('====================================================');
  console.log(`AUTHENTICATED ROUTE TEST RESULTS: ${successCount}/${routes.length} PASSED`);
  console.log('====================================================');

  if (successCount < routes.length) {
    process.exit(1);
  }
}

testAllRoutes().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
