import express from 'express';
import {
  signToken,
  requireAuth,
  verifyGoogleCredential,
  loginOrRegisterGoogleUser,
  devLoginUser,
  isUserAdminEmail,
  isSuperAdminEmail
} from '../auth.js';
import { dbQueries } from '../db.js';
import { resolveUserHonor } from '../honor.js';

const router = express.Router();

export function formatUserResponse(rawUser) {
  const user = resolveUserHonor(rawUser, dbQueries);
  const isSuper = user.is_super_admin === 1 || isSuperAdminEmail(user.email);
  const isAdmin = isSuper || user.is_admin === 1 || user.is_admin === true || isUserAdminEmail(user.email);
  const role = isSuper ? 'Super Admin' : isAdmin ? 'Admin' : 'Fan';

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    role,
    is_admin: isAdmin ? 1 : 0,
    is_super_admin: isSuper ? 1 : 0,
    is_banned: user.is_banned ? 1 : 0,
    honor: user.honor || 'Good',
    honor_updated_at: user.honor_updated_at || user.created_at,
    report_cooldown_until: user.report_cooldown_until || null,
    created_at: user.created_at
  };
}

/**
 * GET /api/auth/me
 * Returns currently authenticated user profile
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: formatUserResponse(req.user)
  });
});

/**
 * POST /api/auth/google
 * Verify Google OAuth Credential (ID Token) and return session token
 */
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Google credential token is required.' });
  }

  try {
    const profile = await verifyGoogleCredential(credential);
    const user = loginOrRegisterGoogleUser(profile);
    const token = signToken(user);

    res.json({
      token,
      user: formatUserResponse(user)
    });
  } catch (err) {
    console.error('Google OAuth error:', err);
    const status = err.status || 401;
    res.status(status).json({ error: err.message || 'Failed to authenticate with Google' });
  }
});

/**
 * GET /api/auth/config
 * Returns client-facing authentication configuration & environment status
 */
router.get('/config', (req, res) => {
  const isStagingOrProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
  const devLoginEnabled = !isStagingOrProduction || process.env.ENABLE_DEV_LOGIN === 'true';
  const googleClientIdConfigured = Boolean(process.env.GOOGLE_CLIENT_ID);

  res.json({
    devLoginEnabled,
    googleClientIdConfigured,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * POST /api/auth/dev-login
 * Instant developer / mock login (disabled in staging/production mode unless ENABLE_DEV_LOGIN=true)
 */
router.post('/dev-login', (req, res) => {
  const isStagingOrProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
  const devLoginEnabled = !isStagingOrProduction || process.env.ENABLE_DEV_LOGIN === 'true';

  if (!devLoginEnabled) {
    const envLabel = process.env.NODE_ENV || 'staging/production';
    return res.status(403).json({ error: `Dev login is disabled in ${envLabel} mode.` });
  }

  const { name, email, avatar_url, is_admin } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'User name is required for Dev Login.' });
  }

  try {
    const user = devLoginUser(name.trim(), email, avatar_url, !!is_admin);
    const token = signToken(user);

    res.json({
      token,
      user: formatUserResponse(user)
    });
  } catch (err) {
    console.error('Dev login error:', err);
    const status = err.status || 403;
    res.status(status).json({ error: err.message || 'Failed to complete dev login.' });
  }
});

export default router;
