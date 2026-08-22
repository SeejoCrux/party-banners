import express from 'express';
import { requireAdmin, requireSuperAdmin, isUserAdminEmail, isSuperAdminEmail } from '../auth.js';
import { dbQueries } from '../db.js';
import { resolveUserHonor } from '../honor.js';

const router = express.Router();

function formatUserSummary(rawUser) {
  const u = resolveUserHonor(rawUser, dbQueries);
  const isSuper = u.is_super_admin === 1 || isSuperAdminEmail(u.email);
  const isAdmin = isSuper || u.is_admin === 1 || u.is_admin === true || isUserAdminEmail(u.email);
  const role = isSuper ? 'Super Admin' : isAdmin ? 'Admin' : 'Fan';

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar_url: u.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.name)}`,
    role,
    is_admin: isAdmin ? 1 : 0,
    is_super_admin: isSuper ? 1 : 0,
    is_banned: u.is_banned === 1 ? 1 : 0,
    banned_at: u.banned_at,
    report_cooldown_until: u.report_cooldown_until,
    honor: u.honor || 'Good',
    honor_updated_at: u.honor_updated_at || u.created_at,
    created_at: u.created_at,
    uploaded_image_count: u.uploaded_image_count || 0,
    uploaded_message_count: u.uploaded_message_count || 0,
    reported_inappropriate_count: u.reported_inappropriate_count || 0
  };
}

/**
 * GET /api/users
 * Rich paginated list of registered users with upload stats, Honor status, and moderation history (Admin only)
 */
router.get('/', requireAdmin, (req, res) => {
  try {
    const { search, filter = 'all', sort = 'newest', page = 1, limit = 10 } = req.query;

    const allUsers = dbQueries.getAllUsersRich.all().map(formatUserSummary);

    let filtered = allUsers;

    // Search by name or email
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }

    // Role / Status / Honor filter
    if (filter === 'banned') {
      filtered = filtered.filter((u) => u.is_banned === 1);
    } else if (filter === 'active') {
      filtered = filtered.filter((u) => u.is_banned === 0);
    } else if (filter === 'admin') {
      filtered = filtered.filter((u) => u.is_admin === 1);
    } else if (filter === 'super_admin') {
      filtered = filtered.filter((u) => u.is_super_admin === 1);
    } else if (filter === 'fan') {
      filtered = filtered.filter((u) => u.is_admin === 0 && u.is_super_admin === 0);
    } else if (filter === 'honor_good') {
      filtered = filtered.filter((u) => u.honor === 'Good');
    } else if (filter === 'honor_poor') {
      filtered = filtered.filter((u) => u.honor === 'Poor');
    } else if (filter === 'honor_bad') {
      filtered = filtered.filter((u) => u.honor === 'Bad');
    } else if (filter === 'flagged') {
      filtered = filtered.filter((u) => u.reported_inappropriate_count > 0);
    }

    // Sorting
    if (sort === 'images') {
      filtered.sort((a, b) => b.uploaded_image_count - a.uploaded_image_count);
    } else if (sort === 'messages') {
      filtered.sort((a, b) => b.uploaded_message_count - a.uploaded_message_count);
    } else if (sort === 'violations') {
      filtered.sort((a, b) => b.reported_inappropriate_count - a.reported_inappropriate_count);
    } else if (sort === 'honor') {
      const honorRank = { Bad: 0, Poor: 1, Good: 2 };
      filtered.sort((a, b) => honorRank[a.honor] - honorRank[b.honor]);
    } else if (sort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else {
      // Default: newest (with Super Admins and Admins prioritized)
      filtered.sort((a, b) => {
        if (b.is_super_admin !== a.is_super_admin) return b.is_super_admin - a.is_super_admin;
        if (b.is_admin !== a.is_admin) return b.is_admin - a.is_admin;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageLimit) || 1;
    const startIndex = (pageNum - 1) * pageLimit;
    const paginated = filtered.slice(startIndex, startIndex + pageLimit);

    res.json({
      users: paginated,
      total,
      page: pageNum,
      totalPages,
      limit: pageLimit
    });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

/**
 * POST /api/users/:id/role
 * Update user role (promote to Admin or demote to Fan).
 * Strictly restricted to Super Admin only.
 */
router.post('/:id/role', requireSuperAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body; // 'admin' | 'fan' | 'user'

    if (!role || !['admin', 'fan', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "admin" or "fan".' });
    }

    const targetUser = dbQueries.findUserById.get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own Super Admin role.' });
    }

    const targetIsSuper = targetUser.is_super_admin === 1 || isSuperAdminEmail(targetUser.email);
    if (targetIsSuper) {
      return res.status(403).json({ error: 'Super Admin roles cannot be altered through promotion/demotion.' });
    }

    const newIsAdmin = role === 'admin' ? 1 : 0;
    dbQueries.setUserAdminRole.run(userId, newIsAdmin);

    const updatedUser = dbQueries.findUserById.get(userId);

    res.json({
      message: `User "${targetUser.name}" has been successfully ${role === 'admin' ? 'promoted to Admin' : 'demoted to Fan'}.`,
      user: formatUserSummary(updatedUser)
    });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ error: 'Failed to update user role: ' + err.message });
  }
});

/**
 * POST /api/users/:id/ban
 * Ban a user (Admin only. Regular Admins cannot ban other Admins; Super Admin can ban Admins.)
 */
router.post('/:id/ban', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const targetUser = dbQueries.findUserById.get(userId);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot ban your own account.' });
    }

    const targetIsSuperAdmin = targetUser.is_super_admin === 1 || isSuperAdminEmail(targetUser.email);
    const targetIsAdmin = targetIsSuperAdmin || targetUser.is_admin === 1 || isUserAdminEmail(targetUser.email);
    const actorIsSuperAdmin = req.user.is_super_admin === 1 || isSuperAdminEmail(req.user.email);

    // 1. Super Admin accounts cannot be banned
    if (targetIsSuperAdmin) {
      return res.status(403).json({ error: 'Super Admin accounts cannot be banned.' });
    }

    // 2. Regular Admins cannot ban other Admins
    if (targetIsAdmin && !actorIsSuperAdmin) {
      return res.status(403).json({
        error: 'Admins cannot ban other Admins. Only Super Admins have permission to ban Admin accounts.'
      });
    }

    dbQueries.setUserBanStatus.run(userId, true);

    const updatedUser = dbQueries.findUserById.get(userId);

    res.json({
      message: `User "${targetUser.name}" has been banned successfully. They cannot log in until unbanned.`,
      user: formatUserSummary(updatedUser)
    });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: 'Failed to ban user: ' + err.message });
  }
});

/**
 * POST /api/users/:id/unban
 * Unban a user (Admin only. Only Super Admin can unban Admin accounts.)
 */
router.post('/:id/unban', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const targetUser = dbQueries.findUserById.get(userId);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetIsAdmin = targetUser.is_admin === 1 || targetUser.is_super_admin === 1 || isUserAdminEmail(targetUser.email);
    const actorIsSuperAdmin = req.user.is_super_admin === 1 || isSuperAdminEmail(req.user.email);

    // If target is an admin, only Super Admin can unban
    if (targetIsAdmin && !actorIsSuperAdmin) {
      return res.status(403).json({
        error: 'Only Super Admins can manage suspension states for Admin accounts.'
      });
    }

    dbQueries.setUserBanStatus.run(userId, false);

    const updatedUser = dbQueries.findUserById.get(userId);

    res.json({
      message: `User "${targetUser.name}" has been unbanned. They can now authenticate.`,
      user: formatUserSummary(updatedUser)
    });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ error: 'Failed to unban user: ' + err.message });
  }
});

export default router;
