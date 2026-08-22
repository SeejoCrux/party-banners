import express from 'express';
import { requireAuth } from '../auth.js';
import { generateBannerTapestry } from '../imageProcessor.js';
import { dbQueries } from '../db.js';

const router = express.Router();

/**
 * GET /api/banner/latest
 * Get the most recently generated banner tapestry for a specific party
 */
router.get('/latest', (req, res) => {
  try {
    const partyId = req.query.party_id ? parseInt(req.query.party_id, 10) : null;
    if (!partyId) {
      return res.status(400).json({ error: 'party_id query parameter is required. Tapestries belong to a Party.' });
    }

    const banner = dbQueries.getLatestPartyBanner.get(partyId);

    if (!banner) {
      return res.json({ banner: null });
    }
    res.json({
      banner: {
        ...banner,
        url: `/uploads/banners/${banner.filename}`
      }
    });
  } catch (err) {
    console.error('Fetch latest banner error:', err);
    res.status(500).json({ error: 'Failed to fetch latest banner: ' + err.message });
  }
});

/**
 * GET /api/banner/history
 * Get previously generated banners for a specific party
 */
router.get('/history', (req, res) => {
  try {
    const partyId = req.query.party_id ? parseInt(req.query.party_id, 10) : null;
    if (!partyId) {
      return res.status(400).json({ error: 'party_id query parameter is required.' });
    }

    const limit = parseInt(req.query.limit, 10) || 10;
    const banners = dbQueries.getPartyBanners.all(partyId, limit);

    const formatted = banners.map((b) => ({
      ...b,
      url: `/uploads/banners/${b.filename}`
    }));
    res.json({ banners: formatted });
  } catch (err) {
    console.error('Fetch banner history error:', err);
    res.status(500).json({ error: 'Failed to fetch banner history: ' + err.message });
  }
});

/**
 * POST /api/banner/generate
 * Generate or regenerate a banner tapestry from uploaded images for a Party.
 * Tapestry Title is decided by Admin and immutable by regular users.
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { columns, limit, party_id } = req.body;
    const rawPartyId = party_id || req.body.partyId;
    const partyId = rawPartyId ? parseInt(rawPartyId, 10) : null;

    if (!partyId) {
      return res.status(400).json({ error: 'party_id is required. Tapestries must belong to a Party.' });
    }

    const party = dbQueries.findPartyById.get(partyId);
    if (!party) {
      return res.status(404).json({ error: 'Selected Party does not exist.' });
    }

    const imageLimit = parseInt(limit, 10) || 24;

    // Fetch images to include in banner (only active and blessed images)
    const images = dbQueries.getRecentPartyImages.all(partyId, imageLimit);

    if (!images || images.length === 0) {
      return res.status(400).json({
        error: `No uploaded images available yet for "${party.name}". Please upload an image first!`
      });
    }

    // Tapestry title is immutable: determined by Admin at Party creation
    const bannerTitle = party.tapestry_title || `${party.name} Tapestry`;

    const result = await generateBannerTapestry(images, {
      title: bannerTitle,
      columns: columns ? parseInt(columns, 10) : undefined
    });

    // Save banner record
    const insertResult = dbQueries.insertBanner.run({
      party_id: partyId,
      filename: result.filename,
      title: bannerTitle,
      image_count: result.imageCount,
      grid_layout: result.gridLayout
    });

    res.status(201).json({
      message: 'Banner tapestry generated successfully!',
      banner: {
        id: insertResult.lastInsertRowid,
        party_id: partyId,
        filename: result.filename,
        title: bannerTitle,
        image_count: result.imageCount,
        grid_layout: result.gridLayout,
        url: result.relativePath,
        width: result.width,
        height: result.height,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Banner generation error:', err);
    res.status(500).json({ error: 'Failed to generate banner: ' + err.message });
  }
});

export default router;
