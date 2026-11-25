const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) return;
  for (const item of fs.readdirSync(full)) {
    const itemPath = path.join(full, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      processDir(path.join(dir, item));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      let c = fs.readFileSync(itemPath, 'utf8');
      let changed = false;

      if (c.includes('bg-red-950/50 border border-red-500/40 text-red-200')) {
        c = c.replace(/bg-red-950\/50 border border-red-500\/40 text-red-200/g, 'bg-orange-50 border border-orange-200 text-orange-800');
        changed = true;
      }
      if (c.includes('bg-red-950/50')) {
        c = c.replace(/bg-red-950\/50/g, 'bg-orange-50');
        changed = true;
      }
      if (c.includes('border-red-500/40')) {
        c = c.replace(/border-red-500\/40/g, 'border-orange-200');
        changed = true;
      }
      if (c.includes('text-red-200')) {
        c = c.replace(/text-red-200/g, 'text-orange-800');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(itemPath, c, 'utf8');
        console.log('Fixed error styles in:', path.join(dir, item));
      }
    }
  }
}

processDir('apps/web/src/components');
processDir('apps/web/src/app');
