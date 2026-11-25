const fs = require('fs');
const path = require('path');

const targetFiles = [
  'apps/web/src/components/tasks/task-create-modal.tsx',
  'apps/web/src/components/tasks/task-edit-modal.tsx',
  'apps/web/src/components/tasks/task-detail-modal.tsx',
  'apps/web/src/components/calls/call-log-modal.tsx',
  'apps/web/src/components/calls/call-edit-modal.tsx',
  'apps/web/src/components/calls/call-detail-modal.tsx',
  'apps/web/src/components/meetings/meeting-create-modal.tsx',
  'apps/web/src/components/meetings/meeting-edit-modal.tsx',
  'apps/web/src/components/meetings/meeting-detail-modal.tsx',
  'apps/web/src/components/accounts/account-create-modal.tsx',
  'apps/web/src/components/accounts/account-edit-modal.tsx',
  'apps/web/src/components/contacts/contact-create-modal.tsx',
  'apps/web/src/components/contacts/contact-edit-modal.tsx',
  'apps/web/src/components/opportunities/opportunity-create-modal.tsx',
  'apps/web/src/components/opportunities/opportunity-edit-modal.tsx',
  'apps/web/src/components/opportunities/add-opportunity-product-modal.tsx',
  'apps/web/src/components/opportunities/closed-lost-modal.tsx',
  'apps/web/src/components/opportunities/quote-editor-modal.tsx',
  'apps/web/src/components/leads/web-to-lead-modal.tsx',
  'apps/web/src/components/activities/record-activity-timeline.tsx',
  'apps/web/src/components/history/record-history-audit.tsx',
  'apps/web/src/components/settings/custom-fields-manager.tsx',
  'apps/web/src/components/settings/sales-regions-manager.tsx',
  'apps/web/src/components/settings/system-audit-log-viewer.tsx',
  'apps/web/src/app/(dashboard)/accounts/[id]/page.tsx',
  'apps/web/src/app/(dashboard)/contacts/[id]/page.tsx',
  'apps/web/src/app/(dashboard)/calls/[id]/page.tsx',
  'apps/web/src/app/(dashboard)/meetings/[id]/page.tsx',
  'apps/web/src/app/(dashboard)/tasks/[id]/page.tsx',
  'apps/web/src/app/(dashboard)/my-jobs/page.tsx',
  'apps/web/src/app/(dashboard)/tasks/page.tsx'
];

for (const rel of targetFiles) {
  const p = path.join(process.cwd(), rel);
  if (!fs.existsSync(p)) {
    console.warn('File not found:', rel);
    continue;
  }
  let content = fs.readFileSync(p, 'utf8');

  // modal & card containers
  content = content.replace(/bg-slate-950\/80/g, 'bg-slate-900/40');
  content = content.replace(/bg-slate-950\/70/g, 'bg-slate-900/40');
  content = content.replace(/bg-slate-900\/80 border border-slate-800/g, 'bg-white border border-slate-200');
  content = content.replace(/bg-slate-900\/70 border border-slate-800/g, 'bg-white border border-slate-200');
  content = content.replace(/bg-slate-900\/60 border border-slate-800/g, 'bg-white border border-slate-200');
  content = content.replace(/bg-slate-900\/40 border border-slate-800/g, 'bg-white border border-slate-200');
  content = content.replace(/bg-slate-900 border border-slate-800/g, 'bg-white border border-slate-200');

  // inner header / footer headers
  content = content.replace(/bg-slate-950\/60/g, 'bg-slate-50');
  content = content.replace(/bg-slate-950\/50/g, 'bg-slate-50');
  content = content.replace(/bg-slate-950\/40/g, 'bg-slate-50');
  content = content.replace(/bg-slate-950\/30/g, 'bg-slate-50');
  content = content.replace(/border-slate-800\/80/g, 'border-slate-200');
  content = content.replace(/border-slate-800/g, 'border-slate-200');

  // headings & titles
  content = content.replace(/text-white text-base font-bold/g, 'text-slate-900 text-base font-bold');
  content = content.replace(/text-base font-bold text-white/g, 'text-base font-bold text-slate-900');
  content = content.replace(/text-lg font-bold text-white/g, 'text-lg font-bold text-slate-900');
  content = content.replace(/text-xl font-bold text-white/g, 'text-xl font-bold text-slate-900');
  content = content.replace(/text-2xl font-bold tracking-tight text-white/g, 'text-2xl font-bold tracking-tight text-slate-900');

  // labels
  content = content.replace(/text-slate-300 uppercase tracking-wider/g, 'text-slate-700 uppercase tracking-wider');
  content = content.replace(/text-slate-300 font-semibold/g, 'text-slate-700 font-semibold');
  content = content.replace(/text-slate-400 uppercase tracking-wider/g, 'text-slate-500 uppercase tracking-wider');

  // close button
  content = content.replace(/text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/g, 'text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100');

  // form controls
  content = content.replace(/bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500/g, 'bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400');
  content = content.replace(/bg-slate-950 border border-slate-700 rounded-lg text-slate-100/g, 'bg-white border border-slate-300 rounded-lg text-slate-900');
  content = content.replace(/bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500/g, 'bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400');
  content = content.replace(/bg-slate-900 border border-slate-700 rounded-lg text-slate-100/g, 'bg-white border border-slate-300 rounded-lg text-slate-900');
  content = content.replace(/bg-slate-950 border border-slate-700/g, 'bg-white border border-slate-300');
  content = content.replace(/bg-slate-950/g, 'bg-white');

  // buttons
  content = content.replace(/bg-slate-800 hover:bg-slate-700 text-slate-300/g, 'bg-slate-100 hover:bg-slate-200 text-slate-700');
  content = content.replace(/bg-slate-800 hover:bg-slate-700 text-white/g, 'bg-slate-100 hover:bg-slate-200 text-slate-800');

  // errors
  content = content.replace(/bg-red-950\/50 border border-red-500\/40 text-red-200/g, 'bg-orange-50 border border-orange-200 text-orange-800');

  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully updated:', rel);
}
