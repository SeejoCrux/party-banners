import express from 'express';
import { requireAuth, verifyToken } from '../auth.js';
import { dbQueries } from '../db.js';

const router = express.Router();

// Active SSE client connections
const sseClients = new Set();

/**
 * Broadcasts an event to all connected SSE clients
 */
export function broadcastSSE(type, payload) {
  const data = JSON.stringify({ type, payload });
  for (const client of sseClients) {
    try {
      client.write(`event: ${type}\ndata: ${data}\n\n`);
    } catch (err) {
      console.error('Error writing to SSE client:', err);
      sseClients.delete(client);
    }
  }
}

/**
 * Optional user extraction from auth header without throwing 401
 */
function getOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      return dbQueries.findUserById.get(decoded.id) || null;
    }
  }
  return null;
}

/**
 * GET /api/messages/stream
 * Server-Sent Events (SSE) stream for live real-time message feed updates
 */
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(': connected\n\n');

  sseClients.add(res);

  const heartbeatTimer = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
});

/**
 * GET /api/messages
 * Fetch paginated message history for a specific party
 */
router.get('/', (req, res) => {
  try {
    const partyId = req.query.party_id ? parseInt(req.query.party_id, 10) : null;
    if (!partyId) {
      return res.status(400).json({ error: 'party_id query parameter is required. Feeds belong to a Party.' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const beforeId = req.query.before ? parseInt(req.query.before, 10) : null;
    const currentUser = getOptionalUser(req);

    const messages = beforeId
      ? dbQueries.getPartyMessagesBeforeId.all(partyId, beforeId, limit)
      : dbQueries.getRecentPartyMessages.all(partyId, limit);

    const formatted = messages.map((m) => ({
      ...m,
      is_own: currentUser ? m.user_id === currentUser.id : false
    }));

    res.json({
      messages: formatted,
      hasMore: messages.length === limit
    });
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages: ' + err.message });
  }
});

/**
 * POST /api/messages
 * Post a new message to a party feed (requires authentication and party_id)
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { text, party_id } = req.body;
    const rawPartyId = party_id || req.body.partyId;
    const partyId = rawPartyId ? parseInt(rawPartyId, 10) : null;

    if (!partyId) {
      return res.status(400).json({ error: 'party_id is required. Messages must be posted to a Party feed.' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty.' });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 255) {
      return res.status(400).json({ error: 'Message cannot exceed 255 characters.' });
    }

    const party = dbQueries.findPartyById.get(partyId);
    if (!party) {
      return res.status(404).json({ error: 'Selected Party does not exist.' });
    }

    const insertResult = dbQueries.insertMessage.run({
      party_id: partyId,
      user_id: req.user.id,
      user_name: req.user.name,
      user_avatar: req.user.avatar_url,
      text: trimmedText
    });

    const newMessage = dbQueries.getMessageById.get(insertResult.lastInsertRowid);

    // Broadcast SSE to all connected clients
    broadcastSSE('message', {
      ...newMessage,
      party_id: partyId
    });

    res.status(201).json({
      message: 'Message posted successfully!',
      data: {
        ...newMessage,
        is_own: true
      }
    });
  } catch (err) {
    console.error('Post message error:', err);
    res.status(500).json({ error: 'Failed to post message: ' + err.message });
  }
});

export default router;
