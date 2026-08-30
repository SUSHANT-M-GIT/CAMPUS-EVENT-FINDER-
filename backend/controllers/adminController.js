const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const safeUserProjection = '-password -otp -otpExpiry -passwordResetToken -passwordResetExpiry';

// GET /api/admin/control-center
exports.getControlCenter = async (req, res) => {
  try {
    const [users, pendingApprovals, auditLogs] = await Promise.all([
      User.find({}, safeUserProjection).sort({ createdAt: -1 }),
      User.countDocuments({ role: 'admin', verificationStatus: 'pending' }),
      AuditLog.find().sort({ createdAt: -1 }).limit(50).populate('actorId', 'name email'),
    ]);
    const counts = users.reduce(
      (result, user) => {
        result.total += 1;
        result[user.role] = (result[user.role] || 0) + 1;
        result[user.accountStatus || 'active'] = (result[user.accountStatus || 'active'] || 0) + 1;
        if (user.isVerified) result.verified += 1;
        return result;
      },
      { total: 0, student: 0, admin: 0, professional: 0, verified: 0, active: 0, flagged: 0, suspended: 0, deactivated: 0 }
    );
    res.json({ counts: { ...counts, pendingApprovals }, users, auditLogs });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// PUT /api/admin/accounts/:id/status
exports.updateAccountStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'flagged', 'suspended', 'deactivated'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid account status.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    user.accountStatus = status;
    await user.save();
    await AuditLog.create({ actorId: req.user.id, targetId: user._id, action: `account_${status}`, details: `${user.email} marked ${status}` });
    res.json({ msg: `Account marked ${status}.` });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// DELETE /api/admin/accounts/:id
exports.deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user._id.toString() === req.user.id) {
      return res.status(403).json({ msg: 'This account cannot be removed.' });
    }
    await User.deleteOne({ _id: user._id });
    await AuditLog.create({ actorId: req.user.id, targetId: user._id, action: 'account_removed', details: `${user.email} removed` });
    res.json({ msg: 'Account removed.' });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── LIST PENDING ADMIN REQUESTS ───────────────────────────────────────────────
// GET /api/admin/requests
exports.listRequests = async (req, res) => {
  try {
    const filter = { verificationStatus: 'pending', clubName: { $ne: '' } };
    const requests = await User.find(filter, '-password -otp -otpExpiry').sort({ createdAt: -1 });
    res.json(requests);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── APPROVE ADMIN REQUEST ─────────────────────────────────────────────────────
// PUT /api/admin/approve/:id
exports.approveAdmin = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(403).json({ msg: 'You cannot approve your own admin verification request.' });
    }

    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ msg: 'User not found' });

    if (u.verificationStatus !== 'pending')
      return res.status(400).json({ msg: `Request is already ${u.verificationStatus}` });

    u.role = 'admin';
    u.verificationStatus = 'approved';
    await u.save();

    res.json({
      msg: `${u.name} has been approved as admin.`,
      user: { id: u._id, name: u.name, role: u.role },
    });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── REJECT ADMIN REQUEST ──────────────────────────────────────────────────────
// PUT /api/admin/reject/:id
exports.rejectAdmin = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ msg: 'User not found' });

    if (u.verificationStatus !== 'pending')
      return res.status(400).json({ msg: `Request is already ${u.verificationStatus}` });

    u.verificationStatus = 'rejected';
    await u.save();

    res.json({ msg: `${u.name}'s admin request has been rejected.` });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};
