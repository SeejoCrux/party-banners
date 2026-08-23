import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { dbQueries } from './db.js';

export function getJwtSecret() {
  return process.env.JWT_SECRET || 'secret-jwt-key-for-dev-mode-375928375';
}

export function getSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS || 'seejo.crux@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || 'admin@example.com,admin@tapestry.local,test.admin@example.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email) {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase().trim());
}

export function isUserAdminEmail(email) {
  if (!email) return false;
  const em = email.toLowerCase().trim();
  return getAdminEmails().includes(em) || isSuperAdminEmail(em);
}

export function signToken(user) {
  const isSuperAdmin = user.is_super_admin === 1 || isSuperAdminEmail(user.email) ? 1 : 0;
  const isAdmin = isSuperAdmin === 1 || user.is_admin === 1 || isUserAdminEmail(user.email) ? 1 : 0;
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      is_admin: isAdmin,
      is_super_admin: isSuperAdmin
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  const user = dbQueries.findUserById.get(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }

  // Check if user is banned
  if (user.is_banned === 1) {
    return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
  }

  // Ensure role properties are set correctly
  user.is_super_admin = (user.is_super_admin === 1 || isSuperAdminEmail(user.email)) ? 1 : 0;
  user.is_admin = (user.is_admin === 1 || user.is_super_admin === 1 || isUserAdminEmail(user.email)) ? 1 : 0;
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.is_admin !== 1) {
      return res.status(403).json({ error: 'Access denied: Admin privileges required.' });
    }
    next();
  });
}

export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.is_super_admin !== 1) {
      return res.status(403).json({ error: 'Access denied: Super Admin privileges required.' });
    }
    next();
  });
}

export async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured on server.');
  }

  const client = new OAuth2Client(clientId, clientSecret);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId
  });

  const payload = ticket.getPayload();
  const isSuper = isSuperAdminEmail(payload.email);
  const isAdmin = isSuper || isUserAdminEmail(payload.email);

  return {
    google_id: payload.sub,
    name: payload.name || payload.given_name || 'Anonymous User',
    email: payload.email,
    avatar_url: payload.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(payload.sub)}`,
    is_admin: isAdmin ? 1 : 0,
    is_super_admin: isSuper ? 1 : 0
  };
}

export function loginOrRegisterGoogleUser(profile) {
  let user = dbQueries.findUserByGoogleId.get(profile.google_id);
  const isSuper = profile.is_super_admin || isSuperAdminEmail(profile.email) ? 1 : 0;
  const isAdmin = isSuper || profile.is_admin || (profile.email && isUserAdminEmail(profile.email)) ? 1 : 0;

  if (user && user.is_banned === 1) {
    const err = new Error('Your account has been suspended by an administrator.');
    err.status = 403;
    throw err;
  }

  if (!user) {
    const result = dbQueries.createUser.run({
      google_id: profile.google_id,
      name: profile.name,
      email: profile.email || '',
      avatar_url: profile.avatar_url || '',
      is_admin: isAdmin,
      is_super_admin: isSuper
    });
    user = dbQueries.findUserById.get(result.lastInsertRowid);
  } else {
    dbQueries.updateUser.run({
      id: user.id,
      name: profile.name || user.name,
      email: profile.email || user.email,
      avatar_url: profile.avatar_url || user.avatar_url,
      is_admin: isAdmin || user.is_admin,
      is_super_admin: isSuper || user.is_super_admin
    });
    user = dbQueries.findUserById.get(user.id);
  }
  user.is_super_admin = isSuper || user.is_super_admin ? 1 : 0;
  user.is_admin = isAdmin || user.is_admin || user.is_super_admin ? 1 : 0;
  return user;
}

export function devLoginUser(name, email, avatarUrl, forcedIsAdmin = false) {
  const devGoogleId = `dev-user-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  let user = dbQueries.findUserByGoogleId.get(devGoogleId);

  if (user && user.is_banned === 1) {
    const err = new Error('Your account has been suspended by an administrator.');
    err.status = 403;
    throw err;
  }

  const finalEmail = email ? email.trim() : `${devGoogleId}@example.com`;
  const isSuper = isSuperAdminEmail(finalEmail) ? 1 : 0;
  const isAdmin = isSuper || forcedIsAdmin || isUserAdminEmail(finalEmail) || name.toLowerCase().includes('admin') ? 1 : 0;
  const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`;

  if (!user) {
    const result = dbQueries.createUser.run({
      google_id: devGoogleId,
      name: name.trim(),
      email: finalEmail,
      avatar_url: finalAvatar,
      is_admin: isAdmin,
      is_super_admin: isSuper
    });
    user = dbQueries.findUserById.get(result.lastInsertRowid);
  } else {
    dbQueries.updateUser.run({
      id: user.id,
      name: name.trim(),
      email: finalEmail,
      avatar_url: finalAvatar,
      is_admin: isAdmin || user.is_admin,
      is_super_admin: isSuper || user.is_super_admin
    });
    user = dbQueries.findUserById.get(user.id);
  }

  user.is_super_admin = isSuper || user.is_super_admin ? 1 : 0;
  user.is_admin = isAdmin || user.is_admin || user.is_super_admin ? 1 : 0;
  return user;
}
