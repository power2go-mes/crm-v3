import { execSync } from 'child_process';

const testSuites = [
  { name: 'Auth Security Verification', script: 'scripts/verify-auth-security.ts' },
  { name: 'Phase 3A Leads Workflows & Conversion', script: 'scripts/verify-phase3a-leads.ts' },
  { name: 'Accounts & Opportunities Workflows', script: 'scripts/verify-accounts-opportunities.ts' },
  { name: 'Contacts Reconciliation Workflows', script: 'scripts/verify-contacts-reconciliation.ts' },
  { name: 'Tasks Module Workflows', script: 'scripts/verify-tasks-workflows.ts' },
  { name: 'Calls Module Workflows', script: 'scripts/verify-calls-workflows.ts' },
  { name: 'Meetings Module Workflows', script: 'scripts/verify-meetings-workflows.ts' },
  { name: 'Campaigns & Members Workflows', script: 'scripts/verify-campaigns-workflows.ts' },
  { name: 'Executive Reports Engine', script: 'scripts/verify-reports-workflows.ts' },
  { name: 'Sales Performance & Quotas', script: 'scripts/verify-sales-performance.ts' },
  { name: 'Settings & Roles Matrix', script: 'scripts/verify-settings-workflows.ts' },
  { name: 'Users & Employee Directory', script: 'scripts/verify-users-workflows.ts' },
  { name: 'Forecast Database RPC & Pipeline Aggregation', script: 'scripts/verify-forecast-rpc.cjs' },
  { name: 'In-App Notification Center & Alerts Drawer', script: 'scripts/verify-notifications.cjs' },
  { name: 'Soft-Delete Recycle Bin & Record Recovery', script: 'scripts/verify-recycle-bin.cjs' },
  { name: 'Web-to-Lead Capture Engine & REST API', script: 'scripts/verify-web-to-lead.cjs' },
  { name: 'Lead Auto-Assignment Rules & Routing', script: 'scripts/verify-lead-assignment.cjs' },
  { name: 'Opportunity Teams & Revenue Splits', script: 'scripts/verify-opportunity-teams.cjs' },
  { name: 'Authenticated Browser Route Audit (27 Routes)', script: 'scripts/verify-browser-routes.ts' },
  { name: 'Interactive Browser Navigation Acceptance (Chrome CDP)', script: 'scripts/verify-interactive-browser-navigation.ts' },
];

console.log('================================================================');
console.log('FINLONEXA CRM v3 — COMPLETE APPLICATION MASTER VERIFICATION SUITE');
console.log('================================================================');

let passedCount = 0;

for (const suite of testSuites) {
  try {
    process.stdout.write(`Executing ${suite.name}... `);
    const cmd = suite.script.endsWith('.cjs') ? `node ${suite.script}` : `npx tsx ${suite.script}`;
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    if (output.includes('[FAIL]')) {
      console.log('FAILED');
      console.log(output);
    } else {
      console.log('PASSED (100%)');
      passedCount++;
    }
  } catch (err: any) {
    console.log('FAILED WITH ERROR');
    console.error(err.stdout || err.message);
  }
}

console.log('================================================================');
console.log(`TOTAL SUITES: ${passedCount}/${testSuites.length} PASSED`);
console.log('================================================================');

if (passedCount < testSuites.length) {
  process.exit(1);
}
