const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('apps/web/.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function setAllPasswords() {
  const { data: { users }, error } = await adminClient.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  const defaultPassword = 'Password123!';
  console.log(`Setting password to "${defaultPassword}" for all ${users.length} accounts...\n`);

  for (const u of users) {
    const { error: updErr } = await adminClient.auth.admin.updateUserById(u.id, {
      password: defaultPassword,
      email_confirm: true
    });
    if (updErr) {
      console.error(`- Failed for ${u.email}:`, updErr.message);
    } else {
      console.log(`- Updated: ${u.email}`);
    }
  }

  console.log('\nAll test user accounts updated successfully with password: Password123!');
}

setAllPasswords();
