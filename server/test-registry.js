import http from 'http';
import sharp from 'sharp';
import app from './index.js';

async function runTests() {
  console.log('🧪 Starting Party Registry & Asset Upload Test Suite...');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(3097, resolve));
  const baseUrl = 'http://localhost:3097';

  try {
    // 1. Dev Login as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Admin Commander', email: 'admin@example.com' })
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    console.log('✅ Admin Logged In:', adminData.user.name);

    // 2. Test Asset Upload for Hero Image
    console.log('🧪 Testing Party Asset Upload (Hero Image)...');
    const heroBuffer = await sharp({
      create: {
        width: 1200,
        height: 600,
        channels: 4,
        background: { r: 14, g: 165, b: 233, alpha: 1 }
      }
    }).jpeg().toBuffer();

    const formData = new FormData();
    const blob = new Blob([heroBuffer], { type: 'image/jpeg' });
    formData.append('file', blob, 'test_hero.jpg');

    const uploadRes = await fetch(`${baseUrl}/api/parties/upload-asset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error('Asset upload failed: ' + uploadData.error);
    console.log('✅ Uploaded hero asset URL:', uploadData.url);

    // 3. Test Party Registration with Uploaded Hero Image
    console.log('🧪 Testing Party Creation with Hero Image...');
    const createPartyRes = await fetch(`${baseUrl}/api/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Quantum Computing Hackathon',
        slug: 'quantum-computing-hackathon',
        hero_image: uploadData.url,
        description: 'Collaborate on quantum algorithms, quantum physics simulations, and quantum key distribution.',
        tags: ['Quantum', 'Physics', 'Algorithms', 'Hackathon'],
        gallery_images: [uploadData.url],
        social_links: {
          website: 'https://quantum-hackathon.example.com',
          twitter: 'https://x.com/quantum_hack'
        }
      })
    });

    const createPartyData = await createPartyRes.json();
    if (!createPartyRes.ok) throw new Error('Party registration failed: ' + createPartyData.error);
    const newParty = createPartyData.party;
    console.log('✅ Registered Party:', newParty.name, 'Hero Image:', newParty.hero_image);

    // 4. Verify Single Party Retrieval
    const getPartyRes = await fetch(`${baseUrl}/api/parties/${newParty.id}`);
    const getPartyData = await getPartyRes.json();
    console.log('✅ Fetched Party Details:', getPartyData.party.name, 'Tags count:', getPartyData.party.tags.length);

    console.log('🎉 ALL PARTY REGISTRY & ASSET TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Registry test failed:', err);
  process.exit(1);
});
