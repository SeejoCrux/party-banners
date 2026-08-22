/**
 * Honor management and automatic progression engine for Fans.
 *
 * Rules:
 * 1. Admins & Super Admins are exempt from reporting cooldowns and Honor degradation.
 * 2. Fans start with "Good" Honor upon registration.
 * 3. Fans with "Good" Honor have NO reporting cooldowns.
 * 4. When a Fan reports content and the report is overturned/blessed by Admin:
 *    - "Good" -> "Poor" (receives 1-hour reporting cooldown).
 *    - "Poor" -> "Bad" (loses reporting privileges entirely).
 *    - "Bad" -> remains "Bad".
 * 5. Fans with "Poor" Honor have a 1-hour reporting cooldown on report submission and on demotion.
 * 6. Fans with "Bad" Honor cannot report content until upgraded.
 * 7. Automatic upgrades over time:
 *    - "Bad" upgrades to "Poor" after 1 week (7 days) from honor_updated_at.
 *    - "Poor" upgrades to "Good" after 1 month (30 days) from honor_updated_at.
 */

export const HONOR = {
  GOOD: 'Good',
  POOR: 'Poor',
  BAD: 'Bad'
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reconcile and calculate the live honor of a user based on elapsed time.
 * If eligible for automatic upgrade, updates the database.
 */
export function resolveUserHonor(user, dbQueries) {
  if (!user) return null;

  const isAdmin = user.is_admin === 1 || user.is_admin === true || user.is_super_admin === 1 || user.is_super_admin === true;

  // Admins & Super Admins are completely exempt from reporting cooldowns and Honor degradation
  if (isAdmin) {
    if (user.report_cooldown_until && dbQueries?.setUserCooldown) {
      dbQueries.setUserCooldown.run(user.id, null);
    }
    return {
      ...user,
      honor: HONOR.GOOD,
      report_cooldown_until: null,
      honor_updated_at: user.honor_updated_at || user.created_at || new Date().toISOString()
    };
  }

  let currentHonor = user.honor || HONOR.GOOD;
  let updatedAtStr = user.honor_updated_at || user.created_at || new Date().toISOString();
  let updatedAt = new Date(updatedAtStr);
  const now = new Date();

  // 1. Upgrade from Bad -> Poor after 1 week
  if (currentHonor === HONOR.BAD) {
    const elapsed = now.getTime() - updatedAt.getTime();
    if (elapsed >= ONE_WEEK_MS) {
      currentHonor = HONOR.POOR;
      const newUpdatedTime = new Date(updatedAt.getTime() + ONE_WEEK_MS).toISOString();
      if (dbQueries && dbQueries.setUserHonorWithTime) {
        dbQueries.setUserHonorWithTime.run(user.id, currentHonor, newUpdatedTime);
      }
      if (dbQueries && dbQueries.setUserCooldown) {
        dbQueries.setUserCooldown.run(user.id, null);
      }
      updatedAtStr = newUpdatedTime;
      updatedAt = new Date(newUpdatedTime);
    }
  }

  // 2. Upgrade from Poor -> Good after 1 month
  if (currentHonor === HONOR.POOR) {
    const elapsed = now.getTime() - updatedAt.getTime();
    if (elapsed >= ONE_MONTH_MS) {
      currentHonor = HONOR.GOOD;
      const newUpdatedTime = new Date(updatedAt.getTime() + ONE_MONTH_MS).toISOString();
      if (dbQueries && dbQueries.setUserHonorWithTime) {
        dbQueries.setUserHonorWithTime.run(user.id, currentHonor, newUpdatedTime);
      }
      if (dbQueries && dbQueries.setUserCooldown) {
        dbQueries.setUserCooldown.run(user.id, null);
      }
      updatedAtStr = newUpdatedTime;
    }
  }

  // Good Honor fans NEVER have cooldowns (clear any legacy cooldowns)
  if (currentHonor === HONOR.GOOD && user.report_cooldown_until) {
    if (dbQueries && dbQueries.setUserCooldown) {
      dbQueries.setUserCooldown.run(user.id, null);
    }
    user.report_cooldown_until = null;
  }

  return {
    ...user,
    honor: currentHonor,
    honor_updated_at: updatedAtStr
  };
}

/**
 * Demotes a Fan's honor when their report is dismissed/blessed by Admin.
 */
export function demoteFanHonor(userId, dbQueries) {
  if (!userId || !dbQueries) return null;

  const rawUser = dbQueries.findUserById.get(userId);
  if (!rawUser) return null;

  // Admins & Super Admins are not subject to Fan Honor demotion
  if (rawUser.is_admin === 1 || rawUser.is_super_admin === 1) {
    return null;
  }

  const user = resolveUserHonor(rawUser, dbQueries);
  let newHonor = user.honor;
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  if (user.honor === HONOR.GOOD) {
    newHonor = HONOR.POOR;
    dbQueries.setUserHonor.run(userId, newHonor);
    dbQueries.setUserCooldown.run(userId, oneHourLater);
  } else if (user.honor === HONOR.POOR) {
    newHonor = HONOR.BAD;
    dbQueries.setUserHonor.run(userId, newHonor);
    dbQueries.setUserCooldown.run(userId, null);
  } else {
    // Already Bad
    newHonor = HONOR.BAD;
    dbQueries.setUserHonor.run(userId, newHonor);
  }

  return {
    previousHonor: user.honor,
    newHonor,
    cooldownApplied: user.honor === HONOR.GOOD
  };
}

/**
 * Check whether a user is permitted to report content.
 * Admins & Super Admins are never restricted by cooldowns or honor.
 */
export function validateReportingPrivilege(user) {
  if (!user) {
    return { allowed: false, status: 401, error: 'Authentication required to report content.' };
  }

  // Admins and Super Admins are NEVER limited by reporting cooldowns or honor
  if (user.is_admin === 1 || user.is_admin === true || user.is_super_admin === 1 || user.is_super_admin === true || user.role === 'Admin' || user.role === 'Super Admin') {
    return { allowed: true };
  }

  // Check Bad Honor prohibition (Fans only)
  if (user.honor === HONOR.BAD) {
    return {
      allowed: false,
      status: 403,
      error: 'Fans with Bad Honor cannot report content. Bad Honor upgrades to Poor Honor after 1 week.'
    };
  }

  // Check active cooldown: ONLY applies to Poor Honor fans
  if (user.honor === HONOR.POOR && user.report_cooldown_until) {
    const cooldownDate = new Date(user.report_cooldown_until);
    const now = new Date();
    if (cooldownDate > now) {
      const remainingMinutes = Math.ceil((cooldownDate - now) / (60 * 1000));
      return {
        allowed: false,
        status: 429,
        error: `You are currently on a reporting cooldown. You can submit new reports in ${remainingMinutes} minute(s).`
      };
    }
  }

  // Good Honor fans are completely unrestricted by cooldowns
  return { allowed: true };
}

/**
 * Applies immediate 1-hour reporting cooldown for Poor Honor fans upon submitting a report.
 */
export function applyFanReportSubmissionCooldown(user, dbQueries) {
  if (!user || !dbQueries) return;
  const isAdmin = user.is_admin === 1 || user.is_admin === true || user.is_super_admin === 1 || user.is_super_admin === true;
  if (!isAdmin && user.honor === HONOR.POOR) {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    dbQueries.setUserCooldown.run(user.id, oneHourLater);
  }
}
