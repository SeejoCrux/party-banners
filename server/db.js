import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envMode = process.env.NODE_ENV;
const defaultDbFilename = envMode === 'staging' ? 'database-staging.sqlite' : envMode === 'production' ? 'database-production.sqlite' : 'database.sqlite';
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, defaultDbFilename);
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    is_admin INTEGER DEFAULT 0,
    is_super_admin INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    banned_at DATETIME,
    report_cooldown_until DATETIME,
    honor TEXT DEFAULT 'Good', -- 'Good', 'Poor', 'Bad'
    honor_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    hero_image TEXT NOT NULL,
    tapestry_title TEXT,
    description TEXT,
    tags TEXT DEFAULT '[]',
    gallery_images TEXT DEFAULT '[]',
    social_links TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active', -- 'active', 'reported', 'banned', 'blessed'
    report_reason TEXT,
    reported_by_id INTEGER,
    reported_at DATETIME,
    mod_reason TEXT,
    moderated_at DATETIME,
    moderated_by_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reported_by_id) REFERENCES users(id),
    FOREIGN KEY (moderated_by_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    original_filename TEXT,
    processed_filename TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'reported', 'banned', 'blessed'
    report_reason TEXT,
    reported_by_id INTEGER,
    reported_at DATETIME,
    mod_reason TEXT,
    moderated_at DATETIME,
    moderated_by_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    title TEXT,
    image_count INTEGER NOT NULL,
    grid_layout TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'reported', 'banned', 'blessed'
    report_reason TEXT,
    reported_by_id INTEGER,
    reported_at DATETIME,
    mod_reason TEXT,
    moderated_at DATETIME,
    moderated_by_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration safety: Ensure new columns exist if table was created in earlier step
const ensureColumn = (table, column, def) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def};`);
  } catch (e) {
    if (!e.message?.includes('duplicate column name')) {
      console.warn(`Note on ALTER TABLE ${table} ADD COLUMN ${column}:`, e.message);
    }
  }
};

ensureColumn('users', 'is_admin', 'INTEGER DEFAULT 0');
ensureColumn('users', 'is_super_admin', 'INTEGER DEFAULT 0');
ensureColumn('users', 'is_banned', 'INTEGER DEFAULT 0');
ensureColumn('users', 'banned_at', 'DATETIME');
ensureColumn('users', 'report_cooldown_until', 'DATETIME');
ensureColumn('users', 'honor', "TEXT DEFAULT 'Good'");
ensureColumn('users', 'honor_updated_at', 'DATETIME');

ensureColumn('parties', 'tapestry_title', 'TEXT');
ensureColumn('parties', 'status', "TEXT DEFAULT 'active'");
ensureColumn('parties', 'report_reason', 'TEXT');
ensureColumn('parties', 'reported_by_id', 'INTEGER');
ensureColumn('parties', 'reported_at', 'DATETIME');
ensureColumn('parties', 'mod_reason', 'TEXT');
ensureColumn('parties', 'moderated_at', 'DATETIME');
ensureColumn('parties', 'moderated_by_id', 'INTEGER');

ensureColumn('images', 'party_id', 'INTEGER REFERENCES parties(id) ON DELETE SET NULL');
ensureColumn('images', 'status', "TEXT DEFAULT 'active'");
ensureColumn('images', 'report_reason', 'TEXT');
ensureColumn('images', 'reported_by_id', 'INTEGER');
ensureColumn('images', 'reported_at', 'DATETIME');
ensureColumn('images', 'mod_reason', 'TEXT');
ensureColumn('images', 'moderated_at', 'DATETIME');
ensureColumn('images', 'moderated_by_id', 'INTEGER');

ensureColumn('banners', 'party_id', 'INTEGER REFERENCES parties(id) ON DELETE SET NULL');

ensureColumn('messages', 'party_id', 'INTEGER REFERENCES parties(id) ON DELETE SET NULL');
ensureColumn('messages', 'status', "TEXT DEFAULT 'active'");
ensureColumn('messages', 'report_reason', 'TEXT');
ensureColumn('messages', 'reported_by_id', 'INTEGER');
ensureColumn('messages', 'reported_at', 'DATETIME');
ensureColumn('messages', 'mod_reason', 'TEXT');
ensureColumn('messages', 'moderated_at', 'DATETIME');
ensureColumn('messages', 'moderated_by_id', 'INTEGER');

// Prepared statement helpers
const stmts = {
  // Users
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  findUserByGoogleId: db.prepare('SELECT * FROM users WHERE google_id = ?'),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)'),
  findUserByName: db.prepare('SELECT * FROM users WHERE name = ?'),
  createUser: db.prepare(`
    INSERT INTO users (google_id, name, email, avatar_url, is_admin, is_super_admin, is_banned, honor, honor_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'Good', CURRENT_TIMESTAMP)
  `),
  updateUser: db.prepare('UPDATE users SET google_id = COALESCE(?, google_id), name = ?, email = ?, avatar_url = ?, is_admin = ?, is_super_admin = ? WHERE id = ?'),
  setUserCooldown: db.prepare('UPDATE users SET report_cooldown_until = ? WHERE id = ?'),
  setUserBanStatus: db.prepare('UPDATE users SET is_banned = ?, banned_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?'),
  setUserAdminRole: db.prepare('UPDATE users SET is_admin = ? WHERE id = ?'),
  setUserHonor: db.prepare('UPDATE users SET honor = ?, honor_updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  setUserHonorWithTime: db.prepare('UPDATE users SET honor = ?, honor_updated_at = ? WHERE id = ?'),
  deleteUserById: db.prepare('DELETE FROM users WHERE id = ?'),
  getAllUsersRich: db.prepare(`
    SELECT 
      u.id,
      u.google_id,
      u.name,
      u.email,
      u.avatar_url,
      u.is_admin,
      u.is_super_admin,
      u.is_banned,
      u.banned_at,
      u.report_cooldown_until,
      COALESCE(u.honor, 'Good') as honor,
      COALESCE(u.honor_updated_at, u.created_at) as honor_updated_at,
      u.created_at,
      (SELECT COUNT(*) FROM images i WHERE i.user_id = u.id) as uploaded_image_count,
      (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) as uploaded_message_count,
      (
        (SELECT COUNT(*) FROM images i WHERE i.user_id = u.id AND i.status = 'banned') +
        (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id AND m.status = 'banned')
      ) as reported_inappropriate_count
    FROM users u
    ORDER BY u.is_super_admin DESC, u.is_admin DESC, u.created_at DESC
  `),

  // Parties
  findPartyById: db.prepare('SELECT * FROM parties WHERE id = ?'),
  findPartyBySlug: db.prepare('SELECT * FROM parties WHERE slug = ?'),
  createParty: db.prepare(`
    INSERT INTO parties (name, slug, hero_image, tapestry_title, description, tags, gallery_images, social_links, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `),
  updateParty: db.prepare(`
    UPDATE parties
    SET name = ?, slug = ?, hero_image = ?, tapestry_title = ?, description = ?, tags = ?, gallery_images = ?, social_links = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  deleteParty: db.prepare('DELETE FROM parties WHERE id = ?'),
  getAllParties: db.prepare('SELECT * FROM parties ORDER BY created_at DESC'),
  getAllPublicParties: db.prepare("SELECT * FROM parties WHERE status IN ('active', 'blessed') ORDER BY created_at DESC"),

  // Images
  insertImage: db.prepare(`
    INSERT INTO images (party_id, user_id, user_name, original_filename, processed_filename, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `),
  getAllImages: db.prepare("SELECT * FROM images WHERE status IN ('active', 'blessed') ORDER BY created_at DESC"),
  getPartyImages: db.prepare("SELECT * FROM images WHERE party_id = ? AND status IN ('active', 'blessed') ORDER BY created_at DESC"),
  getRecentPartyImages: db.prepare("SELECT * FROM images WHERE party_id = ? AND status IN ('active', 'blessed') ORDER BY created_at DESC LIMIT ?"),
  getRecentImages: db.prepare("SELECT * FROM images WHERE status IN ('active', 'blessed') ORDER BY created_at DESC LIMIT ?"),
  getUserImages: db.prepare('SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC'),
  getUserPartyImages: db.prepare('SELECT * FROM images WHERE user_id = ? AND party_id = ? ORDER BY created_at DESC'),
  getImageById: db.prepare('SELECT * FROM images WHERE id = ?'),

  // Banners
  insertBanner: db.prepare('INSERT INTO banners (party_id, filename, title, image_count, grid_layout) VALUES (?, ?, ?, ?, ?)'),
  getLatestPartyBanner: db.prepare('SELECT * FROM banners WHERE party_id = ? ORDER BY created_at DESC LIMIT 1'),
  getLatestBanner: db.prepare('SELECT * FROM banners ORDER BY created_at DESC LIMIT 1'),
  getPartyBanners: db.prepare('SELECT * FROM banners WHERE party_id = ? ORDER BY created_at DESC LIMIT ?'),
  getAllBanners: db.prepare('SELECT * FROM banners ORDER BY created_at DESC LIMIT ?'),

  // Messages
  insertMessage: db.prepare(`
    INSERT INTO messages (party_id, user_id, user_name, user_avatar, text, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `),
  getRecentPartyMessages: db.prepare("SELECT * FROM messages WHERE party_id = ? AND status IN ('active', 'blessed') ORDER BY id DESC LIMIT ?"),
  getRecentMessages: db.prepare("SELECT * FROM messages WHERE status IN ('active', 'blessed') ORDER BY id DESC LIMIT ?"),
  getPartyMessagesBeforeId: db.prepare("SELECT * FROM messages WHERE party_id = ? AND id < ? AND status IN ('active', 'blessed') ORDER BY id DESC LIMIT ?"),
  getMessagesBeforeId: db.prepare("SELECT * FROM messages WHERE id < ? AND status IN ('active', 'blessed') ORDER BY id DESC LIMIT ?"),
  getMessageById: db.prepare('SELECT * FROM messages WHERE id = ?'),

  // Moderation
  reportParty: db.prepare(`
    UPDATE parties
    SET status = 'reported', report_reason = ?, reported_by_id = ?, reported_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status != 'blessed'
  `),
  forceReportParty: db.prepare(`
    UPDATE parties
    SET status = 'reported', report_reason = ?, reported_by_id = ?, reported_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  reportImage: db.prepare(`
    UPDATE images
    SET status = 'reported', report_reason = ?, reported_by_id = ?, reported_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status != 'blessed'
  `),
  forceReportImage: db.prepare(`
    UPDATE images
    SET status = 'reported', report_reason = ?, reported_by_id = ?, reported_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  reportMessage: db.prepare(`
    UPDATE messages
    SET status = 'reported', report_reason = ?, reported_by_id = ?, reported_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status != 'blessed'
  `),
  forceReportMessage: db.prepare(`
    UPDATE messages
    SET status = 'reported', report_reason = ?, reported_by_id = ?, reported_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  reviewParty: db.prepare(`
    UPDATE parties
    SET status = ?, mod_reason = ?, moderated_by_id = ?, moderated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  reviewImage: db.prepare(`
    UPDATE images
    SET status = ?, mod_reason = ?, moderated_by_id = ?, moderated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  reviewMessage: db.prepare(`
    UPDATE messages
    SET status = ?, mod_reason = ?, moderated_by_id = ?, moderated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  getReportedParties: db.prepare(`
    SELECT p.*, u.name as reporter_name, u.email as reporter_email
    FROM parties p
    LEFT JOIN users u ON p.reported_by_id = u.id
    WHERE p.status = 'reported'
    ORDER BY p.reported_at DESC
  `),
  getReportedImages: db.prepare(`
    SELECT i.*, u.name as reporter_name, u.email as reporter_email
    FROM images i
    LEFT JOIN users u ON i.reported_by_id = u.id
    WHERE i.status = 'reported'
    ORDER BY i.reported_at DESC
  `),
  getReportedMessages: db.prepare(`
    SELECT m.*, u.name as reporter_name, u.email as reporter_email
    FROM messages m
    LEFT JOIN users u ON m.reported_by_id = u.id
    WHERE m.status = 'reported'
    ORDER BY m.reported_at DESC
  `),

  // Stats helpers
  getPartyImageCount: db.prepare("SELECT COUNT(*) as count FROM images WHERE party_id = ? AND status IN ('active', 'blessed')"),
  getPartyMessageCount: db.prepare("SELECT COUNT(*) as count FROM messages WHERE party_id = ? AND status IN ('active', 'blessed')")
};

export const dbQueries = {
  // Users
  findUserById: { get: (id) => stmts.findUserById.get(id) },
  findUserByGoogleId: { get: (googleId) => stmts.findUserByGoogleId.get(googleId) },
  findUserByEmail: { get: (email) => stmts.findUserByEmail.get(email) },
  findUserByName: { get: (name) => stmts.findUserByName.get(name) },
  createUser: {
    run: (u) => stmts.createUser.run(
      u.google_id,
      u.name,
      u.email || '',
      u.avatar_url || '',
      u.is_admin ? 1 : 0,
      u.is_super_admin ? 1 : 0
    )
  },
  updateUser: {
    run: (u) => stmts.updateUser.run(
      u.google_id || null,
      u.name,
      u.email || '',
      u.avatar_url || '',
      u.is_admin ? 1 : 0,
      u.is_super_admin ? 1 : 0,
      u.id
    )
  },
  deleteUserById: {
    run: (id) => stmts.deleteUserById.run(id)
  },
  setUserCooldown: {
    run: (userId, cooldownUntil) => stmts.setUserCooldown.run(cooldownUntil, userId)
  },
  setUserBanStatus: {
    run: (userId, isBanned) => stmts.setUserBanStatus.run(isBanned ? 1 : 0, isBanned ? 1 : 0, userId)
  },
  setUserAdminRole: {
    run: (userId, isAdmin) => stmts.setUserAdminRole.run(isAdmin ? 1 : 0, userId)
  },
  setUserHonor: {
    run: (userId, honor) => stmts.setUserHonor.run(honor, userId)
  },
  setUserHonorWithTime: {
    run: (userId, honor, updatedAt) => stmts.setUserHonorWithTime.run(honor, updatedAt, userId)
  },
  getAllUsersRich: {
    all: () => stmts.getAllUsersRich.all()
  },

  // Parties
  findPartyById: { get: (id) => stmts.findPartyById.get(id) },
  findPartyBySlug: { get: (slug) => stmts.findPartyBySlug.get(slug) },
  createParty: {
    run: (p) => stmts.createParty.run(
      p.name,
      p.slug,
      p.hero_image,
      p.tapestry_title || `${p.name} Tapestry`,
      p.description || '',
      typeof p.tags === 'string' ? p.tags : JSON.stringify(p.tags || []),
      typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
      typeof p.social_links === 'string' ? p.social_links : JSON.stringify(p.social_links || {})
    )
  },
  updateParty: {
    run: (p) => stmts.updateParty.run(
      p.name,
      p.slug,
      p.hero_image,
      p.tapestry_title || `${p.name} Tapestry`,
      p.description || '',
      typeof p.tags === 'string' ? p.tags : JSON.stringify(p.tags || []),
      typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
      typeof p.social_links === 'string' ? p.social_links : JSON.stringify(p.social_links || {}),
      p.id
    )
  },
  deleteParty: { run: (id) => stmts.deleteParty.run(id) },
  getAllParties: { all: () => stmts.getAllParties.all() },
  getAllPublicParties: { all: () => stmts.getAllPublicParties.all() },
  getPartyStats: (partyId) => ({
    imagesCount: stmts.getPartyImageCount.get(partyId)?.count || 0,
    messagesCount: stmts.getPartyMessageCount.get(partyId)?.count || 0
  }),

  // Images
  insertImage: {
    run: (img) => stmts.insertImage.run(
      img.party_id || null,
      img.user_id,
      img.user_name,
      img.original_filename,
      img.processed_filename
    )
  },
  getAllImages: { all: () => stmts.getAllImages.all() },
  getPartyImages: { all: (partyId) => stmts.getPartyImages.all(partyId) },
  getRecentImages: { all: (limit = 24) => stmts.getRecentImages.all(limit) },
  getRecentPartyImages: { all: (partyId, limit = 24) => stmts.getRecentPartyImages.all(partyId, limit) },
  getUserImages: { all: (userId) => stmts.getUserImages.all(userId) },
  getUserPartyImages: { all: (userId, partyId) => stmts.getUserPartyImages.all(userId, partyId) },
  getImageById: { get: (id) => stmts.getImageById.get(id) },

  // Banners
  insertBanner: {
    run: (b) => stmts.insertBanner.run(b.party_id || null, b.filename, b.title, b.image_count, b.grid_layout)
  },
  getLatestBanner: { get: () => stmts.getLatestBanner.get() },
  getLatestPartyBanner: { get: (partyId) => stmts.getLatestPartyBanner.get(partyId) },
  getAllBanners: { all: (limit = 10) => stmts.getAllBanners.all(limit) },
  getPartyBanners: { all: (partyId, limit = 10) => stmts.getPartyBanners.all(partyId, limit) },

  // Messages
  insertMessage: {
    run: (m) => stmts.insertMessage.run(m.party_id || null, m.user_id, m.user_name, m.user_avatar, m.text)
  },
  getRecentMessages: { all: (limit = 30) => stmts.getRecentMessages.all(limit) },
  getRecentPartyMessages: { all: (partyId, limit = 30) => stmts.getRecentPartyMessages.all(partyId, limit) },
  getMessagesBeforeId: { all: (beforeId, limit = 30) => stmts.getMessagesBeforeId.all(beforeId, limit) },
  getPartyMessagesBeforeId: { all: (partyId, beforeId, limit = 30) => stmts.getPartyMessagesBeforeId.all(partyId, beforeId, limit) },
  getMessageById: { get: (id) => stmts.getMessageById.get(id) },

  // Moderation
  reportParty: {
    run: (partyId, reason, reporterId) => stmts.reportParty.run(reason, reporterId, partyId)
  },
  forceReportParty: {
    run: (partyId, reason, reporterId) => stmts.forceReportParty.run(reason, reporterId, partyId)
  },
  reportImage: {
    run: (imageId, reason, reporterId) => stmts.reportImage.run(reason, reporterId, imageId)
  },
  forceReportImage: {
    run: (imageId, reason, reporterId) => stmts.forceReportImage.run(reason, reporterId, imageId)
  },
  reportMessage: {
    run: (messageId, reason, reporterId) => stmts.reportMessage.run(reason, reporterId, messageId)
  },
  forceReportMessage: {
    run: (messageId, reason, reporterId) => stmts.forceReportMessage.run(reason, reporterId, messageId)
  },
  reviewParty: {
    run: (partyId, status, modReason, adminId) => stmts.reviewParty.run(status, modReason, adminId, partyId)
  },
  reviewImage: {
    run: (imageId, status, modReason, adminId) => stmts.reviewImage.run(status, modReason, adminId, imageId)
  },
  reviewMessage: {
    run: (messageId, status, modReason, adminId) => stmts.reviewMessage.run(status, modReason, adminId, messageId)
  },
  getReportedParties: { all: () => stmts.getReportedParties.all() },
  getReportedImages: { all: () => stmts.getReportedImages.all() },
  getReportedMessages: { all: () => stmts.getReportedMessages.all() }
};

// Seed default starter parties in dev mode if none exist (or if SEED_SAMPLE_DATA=true)
const isProductionOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
const shouldSeedSampleData = process.env.SEED_SAMPLE_DATA === 'true' || (!isProductionOrStaging && process.env.SEED_SAMPLE_DATA !== 'false');

if (shouldSeedSampleData) {
  const existingParties = stmts.getAllParties.all();
  if (existingParties.length === 0) {
    const defaultParties = [
      {
        name: 'AI Innovators Summit 2026',
        slug: 'ai-innovators-summit-2026',
        hero_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        tapestry_title: 'AI Innovators Tapestry 2026',
        description: 'The premier gathering of AI researchers, model builders, and generative artists collaborating on next-generation intelligence.',
        tags: ['AI', 'Tech', 'Innovation', 'Future'],
        gallery_images: [
          'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80'
        ],
        social_links: {
          website: 'https://example.com/ai-summit',
          twitter: 'https://x.com/aisummit2026',
          bluesky: 'https://bsky.app/profile/ai-summit.bsky.social',
          github: 'https://github.com/ai-summit'
        }
      },
      {
        name: 'Cyberpunk Synthwave Gala',
        slug: 'cyberpunk-synthwave-gala',
        hero_image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
        tapestry_title: 'Cyberpunk Synthwave Mosaic',
        description: 'An electrifying night of neon lights, retro synth beats, and cyberpunk aesthetics celebrating digital music and pixel art.',
        tags: ['Music', 'Cyberpunk', 'Art', 'Nightlife'],
        gallery_images: [
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80'
        ],
        social_links: {
          website: 'https://example.com/synthwave',
          twitter: 'https://x.com/synthgala',
          bluesky: 'https://bsky.app/profile/synthgala.bsky.social',
          instagram: 'https://instagram.com/synthgala'
        }
      },
      {
        name: 'Global Indie Game Jam',
        slug: 'global-indie-game-jam',
        hero_image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        tapestry_title: 'Global Indie Game Jam Tapestry',
        description: '48-hour worldwide challenge where game designers and pixel artists build incredible games around a secret community theme.',
        tags: ['Gaming', 'GameDev', 'Hackathon', 'Community'],
        gallery_images: [
          'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80'
        ],
        social_links: {
          website: 'https://example.com/gamejam',
          bluesky: 'https://bsky.app/profile/indiegamejam.bsky.social',
          github: 'https://github.com/indie-gamejam'
        }
      }
    ];

    for (const party of defaultParties) {
      dbQueries.createParty.run(party);
    }
  }
}

/**
 * Migration helper: Enforces one account per email address.
 * Deletes older copies of an email account, reassigns content references,
 * and creates a unique database index on LOWER(email).
 */
export function deduplicateUsersByEmail() {
  try {
    const duplicates = db.prepare(`
      SELECT LOWER(email) as email, COUNT(*) as count
      FROM users
      WHERE email IS NOT NULL AND TRIM(email) != ''
      GROUP BY LOWER(email)
      HAVING count > 1
    `).all();

    for (const dup of duplicates) {
      // Order by created_at DESC, id DESC so the newest record is kept
      const userRows = db.prepare(`
        SELECT * FROM users
        WHERE LOWER(email) = LOWER(?)
        ORDER BY created_at DESC, id DESC
      `).all(dup.email);

      if (userRows.length > 1) {
        const newestUser = userRows[0];
        const olderUsers = userRows.slice(1);

        for (const oldUser of olderUsers) {
          // Reassign foreign key references to the newest user record
          db.prepare('UPDATE images SET user_id = ? WHERE user_id = ?').run(newestUser.id, oldUser.id);
          db.prepare('UPDATE messages SET user_id = ? WHERE user_id = ?').run(newestUser.id, oldUser.id);
          db.prepare('UPDATE parties SET reported_by_id = ? WHERE reported_by_id = ?').run(newestUser.id, oldUser.id);
          db.prepare('UPDATE parties SET moderated_by_id = ? WHERE moderated_by_id = ?').run(newestUser.id, oldUser.id);
          db.prepare('UPDATE images SET reported_by_id = ? WHERE reported_by_id = ?').run(newestUser.id, oldUser.id);
          db.prepare('UPDATE images SET moderated_by_id = ? WHERE moderated_by_id = ?').run(newestUser.id, oldUser.id);
          db.prepare('UPDATE messages SET reported_by_id = ? WHERE reported_by_id = ?').run(newestUser.id, oldUser.id);
          db.prepare('UPDATE messages SET moderated_by_id = ? WHERE moderated_by_id = ?').run(newestUser.id, oldUser.id);

          // Delete the older copy of the email account
          db.prepare('DELETE FROM users WHERE id = ?').run(oldUser.id);
          console.log(`Deduplicated email '${dup.email}': kept newest user ID ${newestUser.id}, deleted older copy ID ${oldUser.id}`);
        }
      }
    }

    // Create unique index on LOWER(email) to enforce database-level uniqueness
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
      ON users(LOWER(email)) 
      WHERE email IS NOT NULL AND TRIM(email) != '';
    `);
  } catch (e) {
    if (!e.message?.includes('duplicate key') && !e.message?.includes('UNIQUE constraint failed')) {
      console.warn('Note on deduplicateUsersByEmail:', e.message);
    }
  }
}

// Run deduplication migration on startup
deduplicateUsersByEmail();

// Clean and initialize Super Admin and Test Admin accounts
try {
  const superAdminEmail = 'seejo.crux@gmail.com';
  deduplicateUsersByEmail();

  const superUser = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) ORDER BY created_at DESC, id DESC LIMIT 1').get(superAdminEmail);

  if (superUser) {
    db.prepare("UPDATE users SET name = ?, is_admin = 1, is_super_admin = 1, is_banned = 0, honor = 'Good' WHERE id = ?").run(
      'Seejo Crux',
      superUser.id
    );
  } else {
    // Create primary Super Admin
    dbQueries.createUser.run({
      google_id: 'dev-user-seejo-crux',
      name: 'Seejo Crux',
      email: superAdminEmail,
      avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=SeejoCrux`,
      is_admin: 1,
      is_super_admin: 1
    });
  }

  // Ensure test admin exists in dev mode
  if (shouldSeedSampleData) {
    const testAdminEmail = 'test.admin@example.com';
    const testAdmin = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(testAdminEmail);
    if (!testAdmin) {
      dbQueries.createUser.run({
        google_id: 'dev-user-test-admin',
        name: 'Test Admin',
        email: testAdminEmail,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=TestAdmin`,
        is_admin: 1,
        is_super_admin: 0
      });
    }
  }
} catch (e) {
  console.error('Error initializing admin accounts:', e);
}

export default db;
