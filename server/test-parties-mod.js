import http from 'http';
import app from './index.js';

async function runTests() {
  console.log('🧪 Starting Party & Moderation System Test Suite...');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(3098, resolve));
  const baseUrl = 'http://localhost:3098';

  try {
    // 1. Dev Login as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Admin Master', email: 'admin@example.com' })
    });
    const adminData = await adminLoginRes.json();
    console.log('✅ Admin Logged in:', adminData.user.name, 'isAdmin:', adminData.user.is_admin);
    const adminToken = adminData.token;

    // 2. Dev Login as Normal User A (Uploader)
    const userALoginRes = await fetch(`${baseUrl}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Author', email: 'alice@author.com' })
    });
    const userAData = await userALoginRes.json();
    const userAToken = userAData.token;

    // 3. Dev Login as Normal User B (Reporter)
    const userBLoginRes = await fetch(`${baseUrl}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob Watcher', email: 'bob@watcher.com' })
    });
    const userBData = await userBLoginRes.json();
    const userBToken = userBData.token;

    // 4. Test Party Creation (Admin)
    const createPartyRes = await fetch(`${baseUrl}/api/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Neo Tokyo Design Fest',
        slug: 'neo-tokyo-design-fest',
        hero_image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        description: 'Celebrating futuristic digital typography and kinetic architecture.',
        tags: ['Design', 'Typography', 'Tokyo'],
        gallery_images: ['https://images.unsplash.com/photo-1579033461380-adb47c3eb938?auto=format&fit=crop&w=600&q=80'],
        social_links: { twitter: 'https://x.com/neotokyo', website: 'https://neotokyo.design' }
      })
    });
    const partyData = await createPartyRes.json();
    if (!createPartyRes.ok) throw new Error('Party creation failed: ' + partyData.error);
    const partyId = partyData.party.id;
    console.log('✅ Created Party:', partyData.party.name, 'ID:', partyId);

    // 5. Test Party Search & Tag Filtering
    const searchRes = await fetch(`${baseUrl}/api/parties?search=Tokyo&tag=Design`);
    const searchData = await searchRes.json();
    console.log('✅ Party Search found matching count:', searchData.parties.length);
    if (searchData.parties.length === 0) throw new Error('Party search failed');

    // 6. User A posts a message in this Party
    const postMsgRes = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        text: 'This message might be contentious!',
        party_id: partyId
      })
    });
    const msgData = await postMsgRes.json();
    const messageId = msgData.data.id;
    console.log('✅ User A posted message id:', messageId);

    // 7. User B reports User A's message
    const reportRes = await fetch(`${baseUrl}/api/moderation/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        entityType: 'message',
        id: messageId,
        reason: 'Contains inappropriate claims'
      })
    });
    const reportData = await reportRes.json();
    console.log('✅ User B reported message:', reportData.message);

    // Verify message is hidden from public feed
    const publicMsgRes = await fetch(`${baseUrl}/api/messages?party_id=${partyId}`);
    const publicMsgData = await publicMsgRes.json();
    const isVisibleToPublic = publicMsgData.messages.some((m) => m.id === messageId);
    console.log('✅ Reported message hidden from public feed:', !isVisibleToPublic);
    if (isVisibleToPublic) throw new Error('Reported message is still visible to public!');

    // 8. Admin checks Moderation Queue
    const queueRes = await fetch(`${baseUrl}/api/moderation/queue`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const queueData = await queueRes.json();
    console.log('✅ Admin Moderation Queue total pending items:', queueData.totalCount);
    const queuedMsg = queueData.reportedMessages.find((m) => m.id === messageId);
    if (!queuedMsg) throw new Error('Reported message not found in Admin Queue');
    console.log('✅ Found reported message in queue with reason:', queuedMsg.report_reason);

    // 9. Admin reviews: Disagree & Bless with reason
    const blessRes = await fetch(`${baseUrl}/api/moderation/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        entityType: 'message',
        id: messageId,
        action: 'disagree',
        reason: 'Message does not violate policy - verified'
      })
    });
    const blessData = await blessRes.json();
    console.log('✅ Admin blessed message:', blessData.status);

    // 10. Verify message is restored to public view
    const restoredMsgRes = await fetch(`${baseUrl}/api/messages?party_id=${partyId}`);
    const restoredMsgData = await restoredMsgRes.json();
    const isNowVisible = restoredMsgData.messages.some((m) => m.id === messageId);
    console.log('✅ Blessed message restored to public view:', isNowVisible);
    if (!isNowVisible) throw new Error('Blessed message was not restored to public view');

    // 11. Verify User B is on 1-hour cooldown and cannot report again
    const postSecondMsgRes = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        text: 'Second test message',
        party_id: partyId
      })
    });
    const secondMsgData = await postSecondMsgRes.json();
    const secondMsgId = secondMsgData.data.id;

    const tryReportDuringCooldown = await fetch(`${baseUrl}/api/moderation/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        entityType: 'message',
        id: secondMsgId,
        reason: 'Another report during cooldown'
      })
    });
    console.log('✅ Report during cooldown status code (expected 429):', tryReportDuringCooldown.status);
    if (tryReportDuringCooldown.status !== 429) {
      throw new Error('Expected 429 for report during cooldown, got: ' + tryReportDuringCooldown.status);
    }

    // 12. Verify blessed message is immune to reports
    const tryReportBlessedMsg = await fetch(`${baseUrl}/api/moderation/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}` // Admin has no cooldown
      },
      body: JSON.stringify({
        entityType: 'message',
        id: messageId,
        reason: 'Trying to report blessed message'
      })
    });
    console.log('✅ Reporting blessed message status code (expected 400):', tryReportBlessedMsg.status);
    if (tryReportBlessedMsg.status !== 400) {
      throw new Error('Expected 400 for reporting blessed item, got: ' + tryReportBlessedMsg.status);
    }

    // 13. Test Tombstoning (Agree): Report second message as admin and agree
    const report2Res = await fetch(`${baseUrl}/api/moderation/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        entityType: 'message',
        id: secondMsgId,
        reason: 'Confirmed spam'
      })
    });

    const banRes = await fetch(`${baseUrl}/api/moderation/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        entityType: 'message',
        id: secondMsgId,
        action: 'agree',
        reason: 'Spam violation confirmed'
      })
    });
    const banData = await banRes.json();
    console.log('✅ Admin tombstoned (banned) second message:', banData.status);

    console.log('🎉 ALL PARTY & MODERATION TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
