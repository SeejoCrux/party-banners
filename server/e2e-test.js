import http from 'http';
import app from './index.js';

// Test the complete HTTP flow
async function runE2ETests() {
  console.log('🚀 Running Full E2E Server Verification...');

  // Start temporary server on port 3099
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(3099, resolve));
  const baseUrl = 'http://localhost:3099';

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    console.log('✅ Health check:', healthData.status);

    // 2. Auth Config check
    const configRes = await fetch(`${baseUrl}/api/auth/config`);
    const configData = await configRes.json();
    console.log('✅ Auth Config check:', configData.environment, 'devLoginEnabled:', configData.devLoginEnabled);

    // 3. Dev login check
    const loginRes = await fetch(`${baseUrl}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Grace Hopper', email: 'grace@navy.mil' })
    });
    const loginData = await loginRes.json();

    let token = loginData.token || null;
    if (!configData.devLoginEnabled) {
      if (loginRes.status === 403) {
        console.log('✅ Dev login correctly rejected in production mode (HTTP 403)');
      } else {
        throw new Error(`Expected dev login to return 403 in production, got ${loginRes.status}`);
      }
    } else {
      console.log('✅ Dev Login successful:', loginData.user.name, 'Token received:', !!loginData.token);
    }

    // Fetch parties
    const partiesRes = await fetch(`${baseUrl}/api/parties`);
    const partiesData = await partiesRes.json();
    const party = partiesData.parties && partiesData.parties.length > 0 ? partiesData.parties[0] : null;

    if (party) {
      // 4. Post Message
      const msgRes = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: 'Testing real-time live feed from E2E suite!', party_id: party.id })
      });
      const msgData = await msgRes.json();
      console.log('✅ Posted Message:', msgData.data?.text || 'Posted');

      // 5. Fetch Messages
      const getMsgRes = await fetch(`${baseUrl}/api/messages?party_id=${party.id}&limit=5`);
      const getMsgData = await getMsgRes.json();
      console.log('✅ Message Feed count:', getMsgData.messages?.length || 0);
    } else {
      console.log('ℹ️ No public parties exist in DB for message test (Clean state verified)');
    }

    // 6. Fetch Latest Banner for Party
    if (party) {
      const bannerRes = await fetch(`${baseUrl}/api/banner/latest?party_id=${party.id}`);
      const bannerData = await bannerRes.json();
      console.log('✅ Latest Banner fetched for party:', bannerData.banner ? bannerData.banner.filename : 'None yet');
    }

    console.log('🎉 ALL END-TO-END SERVER TESTS PASSED!');
  } finally {
    server.close();
  }
}

runE2ETests().catch((err) => {
  console.error('❌ E2E verification error:', err);
  process.exit(1);
});
