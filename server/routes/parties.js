import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAdmin, verifyToken, isUserAdminEmail, isSuperAdminEmail } from '../auth.js';
import { dbQueries } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const router = express.Router();

const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed.'));
    }
  }
});

function getOptionalAdminUser(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      const user = dbQueries.findUserById.get(decoded.id);
      if (user && (user.is_admin === 1 || user.is_super_admin === 1 || isUserAdminEmail(user.email) || isSuperAdminEmail(user.email))) {
        return user;
      }
    }
  }
  return null;
}

function safeJsonParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function formatParty(party) {
  if (!party) return null;
  const stats = dbQueries.getPartyStats(party.id);
  const latestBanner = dbQueries.getLatestPartyBanner.get(party.id);

  return {
    ...party,
    status: party.status || 'active',
    tapestry_title: party.tapestry_title || (party.name ? `${party.name} Tapestry` : 'Party Tapestry'),
    tags: safeJsonParse(party.tags, []),
    gallery_images: safeJsonParse(party.gallery_images, []),
    social_links: safeJsonParse(party.social_links, {}),
    images_count: stats.imagesCount,
    messages_count: stats.messagesCount,
    latest_banner: latestBanner
      ? {
          ...latestBanner,
          url: `/uploads/banners/${latestBanner.filename}`
        }
      : null
  };
}

/**
 * POST /api/parties/upload-asset
 * Upload hero image or gallery image for a Party (Admin only)
 */
router.post('/upload-asset', requireAdmin, assetUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an image file to upload.' });
    }

    const filename = `party_asset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const outputPath = path.join(UPLOADS_DIR, filename);

    // Optimize and save image with Sharp
    await sharp(req.file.buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(outputPath);

    res.json({
      message: 'Asset uploaded successfully!',
      url: `/uploads/${filename}`,
      filename
    });
  } catch (err) {
    console.error('Asset upload error:', err);
    res.status(500).json({ error: 'Failed to process asset: ' + err.message });
  }
});

/**
 * GET /api/parties
 * Search, filter by tags, sort, and paginate parties.
 * Hides reported and banned parties from non-admin users.
 */
router.get('/', (req, res) => {
  try {
    const { search, tag, sort = 'newest', page = 1, limit = 10, includeReported } = req.query;
    const adminUser = getOptionalAdminUser(req);

    // If requester is Admin and explicitly asks or is in Admin dashboard, include all.
    // Otherwise, regular users only get active & blessed parties.
    const rawParties = (adminUser && includeReported === 'true')
      ? dbQueries.getAllParties.all()
      : dbQueries.getAllPublicParties.all();

    const allParties = rawParties.map(formatParty);

    let filtered = allParties;

    // Search filter (name & description)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Tag filter
    if (tag && tag.trim()) {
      const requestedTags = tag
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (requestedTags.length > 0) {
        filtered = filtered.filter((p) => {
          const partyTags = (p.tags || []).map((t) => String(t).toLowerCase());
          return requestedTags.some((rt) => partyTags.includes(rt));
        });
      }
    }

    // Sorting
    if (sort === 'images') {
      filtered.sort((a, b) => b.images_count - a.images_count);
    } else if (sort === 'messages') {
      filtered.sort((a, b) => b.messages_count - a.messages_count);
    } else if (sort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Default: newest
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageLimit) || 1;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginated = filtered.slice(startIndex, startIndex + pageLimit);

    res.json({
      parties: paginated,
      total,
      page: pageNum,
      totalPages,
      limit: pageLimit
    });
  } catch (err) {
    console.error('Fetch parties error:', err);
    res.status(500).json({ error: 'Failed to fetch parties: ' + err.message });
  }
});

/**
 * GET /api/parties/tags
 * Returns all tags used across parties with frequency counts
 */
router.get('/tags', (req, res) => {
  try {
    const adminUser = getOptionalAdminUser(req);
    const allParties = adminUser
      ? dbQueries.getAllParties.all()
      : dbQueries.getAllPublicParties.all();

    const tagCountMap = {};

    for (const p of allParties) {
      const tags = safeJsonParse(p.tags, []);
      for (const t of tags) {
        if (!t) continue;
        const normalized = String(t).trim();
        tagCountMap[normalized] = (tagCountMap[normalized] || 0) + 1;
      }
    }

    const tagsList = Object.entries(tagCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ tags: tagsList });
  } catch (err) {
    console.error('Fetch tags error:', err);
    res.status(500).json({ error: 'Failed to fetch tags: ' + err.message });
  }
});

/**
 * GET /api/parties/:id
 * Fetch single party by ID or slug.
 * If party is reported or banned, non-admins receive a 403 Forbidden.
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    let party = null;

    if (/^\d+$/.test(id)) {
      party = dbQueries.findPartyById.get(parseInt(id, 10));
    }
    if (!party) {
      party = dbQueries.findPartyBySlug.get(id);
    }

    if (!party) {
      return res.status(404).json({ error: 'Party not found.' });
    }

    const adminUser = getOptionalAdminUser(req);

    // Inaccessibility check: if reported or banned and requester is not Admin, block access
    if (party.status === 'reported' || party.status === 'banned') {
      if (!adminUser) {
        return res.status(403).json({
          error: 'This Party has been reported for community guideline violations and is currently inaccessible pending administrator review.',
          status: party.status,
          partyName: party.name
        });
      }
    }

    res.json({ party: formatParty(party) });
  } catch (err) {
    console.error('Fetch party error:', err);
    res.status(500).json({ error: 'Failed to fetch party: ' + err.message });
  }
});

/**
 * POST /api/parties
 * Create new party (Admin only)
 */
import { createInitialPartyImagesAndBanner } from '../imageProcessor.js';

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, slug, hero_image, tapestry_title, description, tags, gallery_images, social_links } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Party name is required.' });
    }
    if (!hero_image || !hero_image.trim()) {
      return res.status(400).json({ error: 'Hero image (file upload or URL) is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Party description is required.' });
    }

    const parsedTags = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (parsedTags.length === 0) {
      return res.status(400).json({ error: 'Please specify at least one tag for the Party.' });
    }

    const generatedSlug = (slug && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4);

    const finalTapestryTitle = tapestry_title && tapestry_title.trim()
      ? tapestry_title.trim()
      : `${name.trim()} Tapestry`;

    const result = dbQueries.createParty.run({
      name: name.trim(),
      slug: generatedSlug,
      hero_image: hero_image.trim(),
      tapestry_title: finalTapestryTitle,
      description: description.trim(),
      tags: parsedTags,
      gallery_images: Array.isArray(gallery_images) ? gallery_images : typeof gallery_images === 'string' ? gallery_images.split('\n').map(u => u.trim()).filter(Boolean) : [],
      social_links: typeof social_links === 'object' ? social_links : {}
    });

    const newParty = dbQueries.findPartyById.get(result.lastInsertRowid);

    // Automatically generate initial tapestry banner for the new Party
    await createInitialPartyImagesAndBanner(newParty, req.user, dbQueries);

    res.status(201).json({
      message: 'Party registered successfully!',
      party: formatParty(newParty)
    });
  } catch (err) {
    console.error('Create party error:', err);
    res.status(500).json({ error: 'Failed to create party: ' + err.message });
  }
});

/**
 * PUT /api/parties/:id
 * Update an existing party (Admin only)
 */
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const partyId = parseInt(req.params.id, 10);
    const existing = dbQueries.findPartyById.get(partyId);
    if (!existing) {
      return res.status(404).json({ error: 'Party not found.' });
    }

    const { name, slug, hero_image, tapestry_title, description, tags, gallery_images, social_links } = req.body;

    const finalName = name ? name.trim() : existing.name;
    const finalSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : existing.slug;
    const finalHero = hero_image ? hero_image.trim() : existing.hero_image;
    const finalTapestryTitle = tapestry_title !== undefined && tapestry_title.trim()
      ? tapestry_title.trim()
      : (existing.tapestry_title || `${finalName} Tapestry`);
    const finalDesc = description !== undefined ? description.trim() : existing.description;
    const finalTags = tags !== undefined ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : safeJsonParse(existing.tags, []);
    const finalGallery = gallery_images !== undefined ? (Array.isArray(gallery_images) ? gallery_images : gallery_images.split('\n').map(u => u.trim()).filter(Boolean)) : safeJsonParse(existing.gallery_images, []);
    const finalSocials = social_links !== undefined ? social_links : safeJsonParse(existing.social_links, {});

    dbQueries.updateParty.run({
      id: partyId,
      name: finalName,
      slug: finalSlug,
      hero_image: finalHero,
      tapestry_title: finalTapestryTitle,
      description: finalDesc,
      tags: finalTags,
      gallery_images: finalGallery,
      social_links: finalSocials
    });

    const updated = dbQueries.findPartyById.get(partyId);

    res.json({
      message: 'Party updated successfully!',
      party: formatParty(updated)
    });
  } catch (err) {
    console.error('Update party error:', err);
    res.status(500).json({ error: 'Failed to update party: ' + err.message });
  }
});

/**
 * DELETE /api/parties/:id
 * Delete a party (Admin only)
 */
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const partyId = parseInt(req.params.id, 10);
    const existing = dbQueries.findPartyById.get(partyId);
    if (!existing) {
      return res.status(404).json({ error: 'Party not found.' });
    }

    dbQueries.deleteParty.run(partyId);

    res.json({ message: `Party "${existing.name}" deleted successfully.` });
  } catch (err) {
    console.error('Delete party error:', err);
    res.status(500).json({ error: 'Failed to delete party: ' + err.message });
  }
});

export default router;
