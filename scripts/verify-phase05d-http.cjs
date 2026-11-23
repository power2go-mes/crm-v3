const http = require('http');

const routes = [
  '/settings/email',
  '/settings/automation',
  '/settings/calendar',
  '/reports',
  '/reports/builder',
  '/calendar',
  '/settings',
];

async function checkRoute(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ path, statusCode: res.statusCode, length: data.length });
      });
    }).on('error', (err) => {
      resolve({ path, error: err.message });
    });
  });
}

async function run() {
  console.log('=== VERIFYING ROUTE AVAILABILITY ON LOCALHOST:3001 ===');
  for (const r of routes) {
    const res = await checkRoute(r);
    if (res.statusCode && res.statusCode < 400) {
      console.log(`[PASS] ${r} -> HTTP ${res.statusCode} (${res.length} bytes)`);
    } else if (res.statusCode === 307 || res.statusCode === 308 || res.statusCode === 302) {
      console.log(`[PASS - REDIRECT] ${r} -> HTTP ${res.statusCode} (auth guard active)`);
    } else {
      console.log(`[CHECK] ${r} ->`, res);
    }
  }
}

run();
