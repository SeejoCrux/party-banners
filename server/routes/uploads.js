import express from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';
import { processUploadedImage, generateBannerTapestry } from '../imageProcessor.js';
import { dbQueries } from '../db.js';

const router = express.Router();

export const AUTO_REGENERATE_BANNER = process.env.AUTO_REGENERATE_BANNER !== 'false';

// Multer memory storage configuration for file upload validation
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB maximum file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed.'));
    }
  }
});

/**
 * GET /api/uploads
 * Fetch all processed images for gallery (filtered by party_id)
 */
router.get('/', (req, res) => {
  try {
    const partyId = req.query.party_id ? parseInt(req.query.party_id, 10) : null;
    if (!partyId) {
      return res.status(400).json({ error: 'party_id query parameter is required.' });
    }

    const images = dbQueries.getPartyImages.all(partyId);

    const formatted = images.map((img) => ({
      ...img,
      url: `/uploads/${img.processed_filename}`
    }));
    res.json({ images: formatted });
  } catch (err) {
    console.error('Fetch images error:', err);
    res.status(500).json({ error: 'Failed to fetch images: ' + err.message });
  }
});

/**
 * POST /api/uploads
 * Uploads an image, burns the user's name on it, and links it to a Party.
 * If AUTO_REGENERATE_BANNER is true, automatically regenerates the party tapestry!
 */
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an image file to upload.' });
    }

    const rawPartyId = req.body.party_id || req.body.partyId;
    const partyId = rawPartyId ? parseInt(rawPartyId, 10) : null;

    if (!partyId) {
      return res.status(400).json({ error: 'party_id is required. Images must be uploaded to a Party.' });
    }

    const party = dbQueries.findPartyById.get(partyId);
    if (!party) {
      return res.status(404).json({ error: 'Selected Party does not exist.' });
    }

    const customName = req.body.displayName ? req.body.displayName.trim() : req.user.name;
    const processed = await processUploadedImage(req.file.buffer, customName);

    const insertResult = dbQueries.insertImage.run({
      party_id: partyId,
      user_id: req.user.id,
      user_name: customName,
      original_filename: req.file.originalname,
      processed_filename: processed.filename
    });

    const newImage = dbQueries.getImageById.get(insertResult.lastInsertRowid);

    let autoBanner = null;
    if (AUTO_REGENERATE_BANNER) {
      try {
        const imageLimit = 24;
        const images = dbQueries.getRecentPartyImages.all(partyId, imageLimit);

        if (images && images.length > 0) {
          const bannerTitle = party.tapestry_title || `${party.name} Tapestry`;
          const bannerResult = await generateBannerTapestry(images, {
            title: bannerTitle
          });

          const bannerInsert = dbQueries.insertBanner.run({
            party_id: partyId,
            filename: bannerResult.filename,
            title: bannerTitle,
            image_count: bannerResult.imageCount,
            grid_layout: bannerResult.gridLayout
          });

          autoBanner = {
            id: bannerInsert.lastInsertRowid,
            party_id: partyId,
            filename: bannerResult.filename,
            title: bannerTitle,
            image_count: bannerResult.imageCount,
            grid_layout: bannerResult.gridLayout,
            url: bannerResult.relativePath
          };
        }
      } catch (bannerErr) {
        console.error('Auto banner generation failed after image upload:', bannerErr);
      }
    }

    res.status(201).json({
      message: 'Image uploaded, badged with name, and added to Party successfully!',
      image: {
        id: newImage.id,
        party_id: newImage.party_id,
        user_id: newImage.user_id,
        user_name: newImage.user_name,
        processed_filename: newImage.processed_filename,
        url: `/uploads/${newImage.processed_filename}`,
        created_at: newImage.created_at
      },
      regenerated_banner: autoBanner
    });
  } catch (err) {
    console.error('Upload processing error:', err);
    res.status(500).json({ error: 'Failed to process image: ' + err.message });
  }
});

/**
 * GET /api/uploads/user/:userId
 * Fetch all images uploaded by a specific user (optionally filtered by party_id)
 */
router.get('/user/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const partyId = req.query.party_id ? parseInt(req.query.party_id, 10) : null;

    const images = partyId
      ? dbQueries.getUserPartyImages.all(userId, partyId)
      : dbQueries.getUserImages.all(userId);

    const formatted = images.map((img) => ({
      ...img,
      url: `/uploads/${img.processed_filename}`
    }));
    res.json({ images: formatted });
  } catch (err) {
    console.error('Fetch user images error:', err);
    res.status(500).json({ error: 'Failed to fetch user images: ' + err.message });
  }
});

export default router;
