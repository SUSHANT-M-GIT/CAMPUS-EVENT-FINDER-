const User = require('../models/User');

module.exports = async (req, res, next) => {
  const ownerEmail = (process.env.PROJECT_OWNER_EMAIL || process.env.EMAIL_USER)?.trim().toLowerCase();
  if (!ownerEmail) {
    return res.status(503).json({ msg: 'Project owner is not configured.' });
  }

  try {
    const user = await User.findById(req.user?.id).select('email');
    if (!user || user.email.toLowerCase() !== ownerEmail) {
      return res.status(403).json({ msg: 'Only the project owner can manage admin approvals.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ msg: error.message || 'Unable to verify project owner.' });
  }
};