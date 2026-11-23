const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('apps/web/.env.local', 'utf8');
const urlLine = envContent.split(/\r?\n/).find(v => /^NEXT_PUBLIC_SUPABASE_URL\s*=/.test(v));
const keyLine = envContent.split(/\r?\n/).find(v => /^SUPABASE_SERVICE_ROLE_KEY\s*=/.test(v));

if (!urlLine || !keyLine) {
  console.log('Credentials missing from env');
  process.exit(1);
}

const supabaseUrl = urlLine.slice(urlLine.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
const serviceKey = keyLine.slice(keyLine.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

const parsedUrl = new URL(supabaseUrl);

const options = {
  hostname: parsedUrl.hostname,
  port: 443,
  path: '/rest/v1/company_settings?select=id',
  method: 'GET',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  }
};

const req = https.request(options, (res) => {
  console.log(`HTTP Status Code: ${res.statusCode} (${res.statusMessage})`);
  if (res.statusCode === 200) {
    console.log('CONFIRMATION RESULT: Privileged key is ACTIVE and ACCEPTED by Supabase.');
    console.log('CONCLUSION: Historical privileged credential has NOT been revoked.');
  } else if (res.statusCode === 401 || res.statusCode === 403) {
    console.log('CONFIRMATION RESULT: Privileged key was REJECTED with 401/403.');
    console.log('CONCLUSION: Privileged credential appears to be REVOKED or INVALID.');
  } else {
    console.log(`CONFIRMATION RESULT: Unexpected status ${res.statusCode}.`);
  }
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
