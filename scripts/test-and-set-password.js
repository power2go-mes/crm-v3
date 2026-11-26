const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('apps/web/.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const candidatePasswords = [
  'TestPass123!',
  'TestPass123',
  'Password123!',
  'SuperAdmin123!',
  'finlonexa123',
  'password',
  'Admin@123',
  'admin123'
];

async function testLogin() {
  const email = 'test.superadmin@finlonexa.test';
  console.log('Testing authentication for:', email);

  for (const pwd of candidatePasswords) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password: pwd
    });
    if (!error && data?.session) {
      console.log(` SUCCESS! Password for ${email} is: "${pwd}"`);
      return;
    }
  }

  console.log('None of the candidate passwords matched. Resetting password for test.superadmin@finlonexa.test now...');
  const newPassword = 'Password123!';
  const { data: user, error: updateErr } = await adminClient.auth.admin.updateUserById(
    '37236616-9978-4a5e-9aaf-b88167e311b6',
    { password: newPassword }
  );

  if (updateErr) {
    console.error('Failed to set password:', updateErr);
  } else {
    console.log(` Successfully set password to "${newPassword}" for test.superadmin@finlonexa.test!`);
    
    // Verify
    const verify = await anonClient.auth.signInWithPassword({
      email,
      password: newPassword
    });
    if (verify.data?.session) {
      console.log(' Verification signInWithPassword succeeded!');
    } else {
      console.error(' Verification signInWithPassword failed:', verify.error);
    }
  }
}

testLogin();
