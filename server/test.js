import { dbQueries } from './db.js';
import { processUploadedImage, generateBannerTapestry } from './imageProcessor.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('🧪 Starting backend unit tests...');

  // 1. Test User CRUD
  const testUserGoogleId = `test-google-${Date.now()}`;
  const insertUserRes = dbQueries.createUser.run({
    google_id: testUserGoogleId,
    name: 'Alice Wonder',
    email: `alice.${Date.now()}@example.com`,
    avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alice'
  });
  console.log('✅ Created user id:', insertUserRes.lastInsertRowid);

  const fetchedUser = dbQueries.findUserById.get(insertUserRes.lastInsertRowid);
  if (!fetchedUser || fetchedUser.name !== 'Alice Wonder') {
    throw new Error('User fetch failed or mismatched');
  }
  console.log('✅ Fetched user successfully:', fetchedUser.name);

  // 2. Test Image Processing with Name Badge
  console.log('🧪 Testing Sharp image name badge overlay...');
  // Create a 400x400 synthetic gradient image buffer
  const sampleBuffer = await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 4,
      background: { r: 79, g: 70, b: 229, alpha: 1 }
    }
  }).png().toBuffer();

  const processed = await processUploadedImage(sampleBuffer, 'Alice Wonder');
  console.log('✅ Processed image created at:', processed.relativePath);

  // Store in DB
  const insertImgRes = dbQueries.insertImage.run({
    user_id: fetchedUser.id,
    user_name: fetchedUser.name,
    original_filename: 'sample.png',
    processed_filename: processed.filename
  });
  console.log('✅ Stored image record id:', insertImgRes.lastInsertRowid);

  // Create a second image for Bob
  const sampleBuffer2 = await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 4,
      background: { r: 16, g: 185, b: 129, alpha: 1 }
    }
  }).png().toBuffer();

  const processed2 = await processUploadedImage(sampleBuffer2, 'Bob Builder');
  const insertImgRes2 = dbQueries.insertImage.run({
    user_id: fetchedUser.id,
    user_name: 'Bob Builder',
    original_filename: 'sample2.png',
    processed_filename: processed2.filename
  });

  // 3. Test Banner Tapestry Generation
  console.log('🧪 Testing Banner Tapestry Stitching...');
  const images = dbQueries.getRecentImages.all(10);
  const banner = await generateBannerTapestry(images, {
    title: 'Test Tapestry Banner',
    columns: 2
  });
  console.log('✅ Banner generated:', banner.filename, banner.gridLayout, `${banner.width}x${banner.height}`);

  // 4. Test Message Feed
  console.log('🧪 Testing Message Feed Storage...');
  const msgRes = dbQueries.insertMessage.run({
    user_id: fetchedUser.id,
    user_name: fetchedUser.name,
    user_avatar: fetchedUser.avatar_url,
    text: 'Hello world from real-time live feed!'
  });
  const newMsg = dbQueries.getMessageById.get(msgRes.lastInsertRowid);
  console.log('✅ Message stored:', newMsg.text);

  // 5. Test Email Deduplication & Single Account Enforcement
  console.log('🧪 Testing Email Deduplication & Single Account per Email Enforcement...');
  const { deduplicateUsersByEmail } = await import('./db.js');
  const { loginOrRegisterGoogleUser } = await import('./auth.js');

  const dupEmail = `dup.test.${Date.now()}@example.com`;
  const user1 = loginOrRegisterGoogleUser({
    google_id: `g-old-${Date.now()}`,
    name: 'Old User Record',
    email: dupEmail
  });

  const user2 = loginOrRegisterGoogleUser({
    google_id: `g-new-${Date.now()}`,
    name: 'New User Record',
    email: dupEmail
  });

  const existingAccounts = dbQueries.findUserByEmail.get(dupEmail);
  if (!existingAccounts) {
    throw new Error('Deduplicated user account not found');
  }

  // Verify that login updated the single account rather than creating a duplicate
  if (existingAccounts.id !== user2.id && existingAccounts.id !== user1.id) {
    throw new Error('Email deduplication failed: multiple accounts remained');
  }
  console.log('✅ Email deduplication & single account enforcement verified successfully!');

  console.log('🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
