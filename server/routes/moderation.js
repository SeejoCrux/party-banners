import express from 'express';
import { requireAuth, requireAdmin, isSuperAdminEmail } from '../auth.js';
import { dbQueries } from '../db.js';
import {
  resolveUserHonor,
  demoteFanHonor,
  validateReportingPrivilege,
  applyFanReportSubmissionCooldown
} from '../honor.js';
import { broadcastSSE } from './messages.js';
import { generateBannerTapestry } from '../imageProcessor.js';
import { formatUserResponse } from './auth.js';

const router = express.Router();

async function autoRegeneratePartyBanner(partyId) {
  if (!partyId) return;
  try {
    const party = dbQueries.findPartyById.get(partyId);
    if (!party) return;
    const remainingImages = dbQueries.getRecentPartyImages.all(partyId, 24);
    if (remainingImages && remainingImages.length > 0) {
      const bannerTitle = party.tapestry_title || `${party.name} Tapestry`;
      const bannerResult = await generateBannerTapestry(remainingImages, { title: bannerTitle });
      dbQueries.insertBanner.run({
        party_id: partyId,
        filename: bannerResult.filename,
        title: bannerTitle,
        image_count: bannerResult.imageCount,
        grid_layout: bannerResult.gridLayout
      });
    }
  } catch (e) {
    console.error('Error auto-regenerating banner after moderation:', e);
  }
}

/**
 * POST /api/moderation/report
 * Report a party, image, or message as inappropriate
 */
router.post('/report', requireAuth, async (req, res) => {
  try {
    const { entityType, id, reason } = req.body;
    const rawUser = dbQueries.findUserById.get(req.user.id);
    const user = resolveUserHonor(rawUser, dbQueries);

    if (!entityType || !id) {
      return res.status(400).json({ error: 'entityType ("party", "image", or "message") and id are required.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Please provide a reason for the report.' });
    }

    // 1. Validate Honor & Reporting Privilege (Bad Honor blocked, Cooldown check for Poor Honor)
    const privilege = validateReportingPrivilege(user);
    if (!privilege.allowed) {
      return res.status(privilege.status).json({ error: privilege.error });
    }

    const entityId = parseInt(id, 10);
    const trimmedReason = reason.trim();
    let partyIdToRebuild = null;

    const isSuper = user.is_super_admin === 1 || isSuperAdminEmail(user.email);

    // 2. Fetch Entity & Verify Blessed Status (Super Admin can override and act on Blessed content)
    if (entityType === 'party') {
      const party = dbQueries.findPartyById.get(entityId);
      if (!party) {
        return res.status(404).json({ error: 'Party not found.' });
      }
      if (party.status === 'blessed' && !isSuper) {
        return res.status(400).json({
          error: 'This Party has been reviewed and blessed by an Admin and is immune to further reports.'
        });
      }

      if (party.status === 'blessed' && isSuper) {
        dbQueries.forceReportParty.run(entityId, trimmedReason, user.id);
      } else {
        dbQueries.reportParty.run(entityId, trimmedReason, user.id);
      }
    } else if (entityType === 'image') {
      const img = dbQueries.getImageById.get(entityId);
      if (!img) {
        return res.status(404).json({ error: 'Image not found.' });
      }
      if (img.status === 'blessed' && !isSuper) {
        return res.status(400).json({
          error: 'This image has been reviewed and blessed by an Admin and is immune to further reports.'
        });
      }
      if (img.user_id === user.id && !isSuper) {
        return res.status(400).json({ error: 'You cannot report your own uploaded image.' });
      }

      if (img.status === 'blessed' && isSuper) {
        dbQueries.forceReportImage.run(entityId, trimmedReason, user.id);
      } else {
        dbQueries.reportImage.run(entityId, trimmedReason, user.id);
      }
      partyIdToRebuild = img.party_id;
    } else if (entityType === 'message') {
      const msg = dbQueries.getMessageById.get(entityId);
      if (!msg) {
        return res.status(404).json({ error: 'Message not found.' });
      }
      if (msg.status === 'blessed' && !isSuper) {
        return res.status(400).json({
          error: 'This message has been reviewed and blessed by an Admin and is immune to further reports.'
        });
      }
      if (msg.user_id === user.id && !isSuper) {
        return res.status(400).json({ error: 'You cannot report your own message.' });
      }

      if (msg.status === 'blessed' && isSuper) {
        dbQueries.forceReportMessage.run(entityId, trimmedReason, user.id);
      } else {
        dbQueries.reportMessage.run(entityId, trimmedReason, user.id);
      }
    } else {
      return res.status(400).json({ error: 'Invalid entityType. Must be "party", "image", or "message".' });
    }

    // 3. If Fan has Poor Honor, apply immediate 1-hour reporting cooldown
    applyFanReportSubmissionCooldown(user, dbQueries);

    // 4. Auto-regenerate tapestry if image was reported
    if (partyIdToRebuild) {
      await autoRegeneratePartyBanner(partyIdToRebuild);
    }

    // 5. Broadcast SSE moderation event so connected clients update instantly
    broadcastSSE('content_reported', {
      entityType,
      id: entityId,
      partyId: partyIdToRebuild
    });

    const updatedUser = dbQueries.findUserById.get(user.id);

    res.json({
      success: true,
      message: `Report submitted successfully. The ${entityType} is now inaccessible to guests and regular users pending Admin review.`,
      entityType,
      id: entityId,
      user: formatUserResponse(updatedUser)
    });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to submit report: ' + err.message });
  }
});

/**
 * GET /api/moderation/queue
 * Get all reported parties, images, and messages (Admin only)
 */
router.get('/queue', requireAdmin, (req, res) => {
  try {
    const reportedParties = dbQueries.getReportedParties.all();
    const reportedImages = dbQueries.getReportedImages.all().map((img) => ({
      ...img,
      url: `/uploads/${img.processed_filename}`
    }));
    const reportedMessages = dbQueries.getReportedMessages.all();

    res.json({
      reportedParties,
      reportedImages,
      reportedMessages,
      totalCount: reportedParties.length + reportedImages.length + reportedMessages.length
    });
  } catch (err) {
    console.error('Fetch moderation queue error:', err);
    res.status(500).json({ error: 'Failed to fetch moderation queue: ' + err.message });
  }
});

/**
 * POST /api/moderation/review
 * Admin reviews a reported item: Agree (Tombstone / Ban) or Disagree (Bless + Demote Fan Honor)
 * Super Admin can moderate any report including their own.
 */
router.post('/review', requireAdmin, async (req, res) => {
  try {
    const { entityType, id, action, reason } = req.body;
    const admin = req.user;

    if (!entityType || !id || !action) {
      return res.status(400).json({ error: 'entityType, id, and action ("agree" or "disagree") are required.' });
    }

    const entityId = parseInt(id, 10);
    const modReason = reason ? reason.trim() : (action === 'agree' ? 'Violates community standards' : 'Content approved by Admin');

    let reporterId = null;
    let partyIdToRebuild = null;

    if (entityType === 'party') {
      const party = dbQueries.findPartyById.get(entityId);
      if (!party) return res.status(404).json({ error: 'Party not found.' });
      reporterId = party.reported_by_id;
    } else if (entityType === 'image') {
      const img = dbQueries.getImageById.get(entityId);
      if (!img) return res.status(404).json({ error: 'Image not found.' });
      reporterId = img.reported_by_id;
      partyIdToRebuild = img.party_id;
    } else if (entityType === 'message') {
      const msg = dbQueries.getMessageById.get(entityId);
      if (!msg) return res.status(404).json({ error: 'Message not found.' });
      reporterId = msg.reported_by_id;
    } else {
      return res.status(400).json({ error: 'Invalid entityType.' });
    }

    const isSuperAdminUser = admin.is_super_admin === 1 || isSuperAdminEmail(admin.email);

    if (!isSuperAdminUser && reporterId && reporterId === admin.id) {
      return res.status(403).json({
        error: 'Conflict of Interest: You cannot moderate content that you reported. Another Admin must review this report.'
      });
    }

    if (action === 'agree') {
      // 1. Tombstone / Ban
      const targetStatus = 'banned';
      if (entityType === 'party') {
        dbQueries.reviewParty.run(entityId, targetStatus, modReason, admin.id);
      } else if (entityType === 'image') {
        dbQueries.reviewImage.run(entityId, targetStatus, modReason, admin.id);
      } else {
        dbQueries.reviewMessage.run(entityId, targetStatus, modReason, admin.id);
      }

      if (partyIdToRebuild) {
        await autoRegeneratePartyBanner(partyIdToRebuild);
      }

      broadcastSSE('content_reviewed', {
        entityType,
        id: entityId,
        status: targetStatus,
        partyId: partyIdToRebuild
      });

      res.json({
        success: true,
        message: `Report confirmed: ${entityType} has been banned and permanently hidden from public users. Reason: "${modReason}".`,
        status: targetStatus
      });
    } else if (action === 'disagree') {
      // 2. Disagree (Bless content + Demote reporter Fan Honor)
      const targetStatus = 'blessed';
      if (entityType === 'party') {
        dbQueries.reviewParty.run(entityId, targetStatus, modReason, admin.id);
      } else if (entityType === 'image') {
        dbQueries.reviewImage.run(entityId, targetStatus, modReason, admin.id);
      } else {
        dbQueries.reviewMessage.run(entityId, targetStatus, modReason, admin.id);
      }

      let demotionInfo = null;
      if (reporterId) {
        demotionInfo = demoteFanHonor(reporterId, dbQueries);
      }

      if (partyIdToRebuild) {
        await autoRegeneratePartyBanner(partyIdToRebuild);
      }

      const demotionMsg = demotionInfo
        ? ` Reporter's Honor decreased from ${demotionInfo.previousHonor} to ${demotionInfo.newHonor}.`
        : '';

      broadcastSSE('content_reviewed', {
        entityType,
        id: entityId,
        status: targetStatus,
        partyId: partyIdToRebuild
      });

      res.json({
        success: true,
        message: `Report dismissed: ${entityType} has been blessed and restored to public view.${demotionMsg}`,
        status: targetStatus,
        reporterHonor: demotionInfo?.newHonor
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "agree" or "disagree".' });
    }
  } catch (err) {
    console.error('Moderation review error:', err);
    res.status(500).json({ error: 'Failed to process moderation review: ' + err.message });
  }
});

export default router;
