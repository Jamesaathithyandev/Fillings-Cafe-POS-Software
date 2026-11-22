const https = require('https');

const SUPABASE_URL = 'https://ffmzwilwfwdetjxavtbr.supabase.co';
const ANON_KEY = 'sb_publishable_yO5MA4ftWpXUWZCn3j68UA_fY2E4H0v';

console.log('Testing Supabase Cloud connection to:', SUPABASE_URL);

const req = https.get(`${SUPABASE_URL}/rest/v1/categories?select=id&limit=1`, {
  headers: {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`
  },
  timeout: 5000
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Supabase database is ONLINE and reachable!');
    } else {
      console.log(`⚠️ HTTP Status ${res.statusCode}: ${body}`);
    }
  });
});

req.on('error', (err) => {
  if (err.code === 'ENOTFOUND') {
    console.log('❌ Project is still PAUSED (DNS not found). Please click "Restore project" in the Supabase Dashboard.');
  } else {
    console.log(`❌ Connection error: ${err.message}`);
  }
});

req.on('timeout', () => {
  req.destroy();
  console.log('❌ Request timed out. Database might still be waking up.');
});
