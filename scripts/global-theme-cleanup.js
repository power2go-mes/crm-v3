const fs = require('fs');
const path = require('path');

function walk(dir) {
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) return;
  for (const item of fs.readdirSync(full)) {
    const itemPath = path.join(full, item);
    const rel = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      walk(rel);
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      let c = fs.readFileSync(itemPath, 'utf8');
      let changed = false;

      // Clean leftover dark: utilities (since dark mode was dark-themed before)
      if (c.includes('dark:bg-slate-900') || c.includes('dark:border-slate-800') || c.includes('dark:bg-slate-950')) {
        c = c.replace(/dark:bg-slate-900/g, '');
        c = c.replace(/dark:bg-slate-950/g, '');
        c = c.replace(/dark:border-slate-800/g, '');
        c = c.replace(/dark:text-slate-400/g, '');
        c = c.replace(/dark:text-white/g, '');
        changed = true;
      }

      // In regular cards & pages:
      if (c.includes('bg-slate-900/60 border border-slate-800') || c.includes('bg-slate-900/50 border border-slate-800') || c.includes('bg-slate-900 border border-slate-800')) {
        c = c.replace(/bg-slate-900\/60 border border-slate-800/g, 'bg-white border border-slate-200');
        c = c.replace(/bg-slate-900\/50 border border-slate-800/g, 'bg-white border border-slate-200');
        c = c.replace(/bg-slate-900\/40 border border-slate-800/g, 'bg-white border border-slate-200');
        c = c.replace(/bg-slate-900 border border-slate-800/g, 'bg-white border border-slate-200');
        changed = true;
      }

      // Replace bg-slate-900 button styles with emerald
      if (c.includes('bg-slate-900 hover:bg-slate-800 text-white')) {
        c = c.replace(/bg-slate-900 hover:bg-slate-800 text-white/g, 'bg-emerald-600 hover:bg-emerald-700 text-white');
        changed = true;
      }
      if (c.includes('bg-slate-900 text-white font-bold')) {
        c = c.replace(/bg-slate-900 text-white font-bold/g, 'bg-emerald-600 text-white font-bold shadow-xs');
        changed = true;
      }

      // Sub-containers in detail pages
      if (c.includes('bg-slate-900/40 border-b border-slate-200')) {
        c = c.replace(/bg-slate-900\/40 border-b border-slate-200/g, 'bg-slate-50 border-b border-slate-200');
        changed = true;
      }

      // Clean double spaces in className
      if (changed) {
        c = c.replace(/className="([^"]*)"/g, (match, classes) => {
          return 'className="' + classes.replace(/\s+/g, ' ').trim() + '"';
        });
        fs.writeFileSync(itemPath, c, 'utf8');
        console.log('Cleaned theme classes in:', rel);
      }
    }
  }
}

walk('apps/web/src/app');
walk('apps/web/src/components');
