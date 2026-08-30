const User = require('../models/User');

const RESERVED_PROJECT_OWNER_EMAIL = 'mishrasushant029@gmail.com';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function configuredSuperAdminEmail() {
  const configured = process.env.SUPER_ADMIN_EMAIL || process.env.PROJECT_OWNER_EMAIL || process.env.EMAIL_USER || RESERVED_PROJECT_OWNER_EMAIL;
  return normalizeEmail(configured);
}

function isConfiguredSuperAdmin(user) {
  const configuredId = process.env.SUPER_ADMIN_USER_ID?.trim();
  if (configuredId) return user?._id?.toString() === configuredId;
  const configuredEmail = configuredSuperAdminEmail();
  return Boolean(configuredEmail && normalizeEmail(user?.email) === configuredEmail);
}

async function resolveSuperAdmin(req, res, next) {
  try {
    if (req.user?.superAdminVerified !== true) {
      return res.status(403).json({ msg: 'Additional verification is required.' });
    }
    const user = await User.findById(req.user?.id).select('_id email name role accountStatus');
    if (!user || !isConfiguredSuperAdmin(user)) {
      return res.status(403).json({ msg: 'Only the project owner can access this area.' });
    }
    if (user.accountStatus === 'suspended' || user.accountStatus === 'deactivated') {
      return res.status(403).json({ msg: 'The project owner account is not active.' });
    }
    req.superAdmin = user;
    next();
  } catch (error) {
    res.status(500).json({ msg: error.message || 'Unable to verify Super Admin identity.' });
  }
}

resolveSuperAdmin.isConfiguredSuperAdmin = isConfiguredSuperAdmin;
resolveSuperAdmin.configuredSuperAdminEmail = configuredSuperAdminEmail;

module.exports = resolveSuperAdmin;