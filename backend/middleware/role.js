/**
 * role.js — Role-based access control middleware
 *
 * Usage:
 *   router.post("/", auth, role(["admin"]), handler);
 *   router.post("/", auth, adminOnly, handler);
 */

/**
 * Normalize role string to standard internal role: 'admin', 'student', 'professional'
 */
function normalizeRole(role) {
  if (!role) return '';
  const r = String(role).trim().toLowerCase();
  if (
    r === 'admin' ||
    r === 'organizer' ||
    r === 'admin / organizer' ||
    r === 'superadmin' ||
    r === 'super_admin' ||
    r === 'super admin'
  ) {
    return 'admin';
  }
  if (
    r === 'professional' ||
    r === 'working professional' ||
    r === 'working professional / general'
  ) {
    return 'professional';
  }
  if (r === 'student') {
    return 'student';
  }
  return r;
}

/** Generic: pass an array of allowed roles */
const role = (roles) => (req, res, next) => {
  const userRole = normalizeRole(req.user?.role);
  const allowedRoles = (Array.isArray(roles) ? roles : [roles]).map(normalizeRole);

  if (!req.user || !allowedRoles.includes(userRole)) {
    return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
  }
  next();
};

/** Convenience: admin-only shorthand */
const adminOnly = (req, res, next) => {
  const userRole = normalizeRole(req.user?.role);
  if (!req.user || userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  next();
};

module.exports = role;
module.exports.adminOnly = adminOnly;
module.exports.normalizeRole = normalizeRole;
