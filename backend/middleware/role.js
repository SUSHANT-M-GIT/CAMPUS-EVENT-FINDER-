/**
 * role.js — Role-based access control middleware
 *
 * Usage:
 *   router.post("/", auth, role(["admin"]), handler);
 *   router.post("/", auth, adminOnly, handler);
 */

/** Generic: pass an array of allowed roles */
const role = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
};

/** Convenience: admin-only shorthand */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  next();
};

module.exports = role;
module.exports.adminOnly = adminOnly;
