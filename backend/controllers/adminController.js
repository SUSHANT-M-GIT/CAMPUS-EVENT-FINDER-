const User = require("../models/User");

// ── LIST PENDING ADMIN REQUESTS ───────────────────────────────────────────────
// GET /api/admin/requests
exports.listRequests = async (req, res) => {
  try {
    const requests = await User.find(
      { verificationStatus: "pending", clubName: { $ne: "" } },
      "-password -otp -otpExpiry"
    ).sort({ createdAt: -1 });
    res.json(requests);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── APPROVE ADMIN REQUEST ─────────────────────────────────────────────────────
// PUT /api/admin/approve/:id
exports.approveAdmin = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ msg: "User not found" });

    if (u.verificationStatus !== "pending")
      return res.status(400).json({ msg: `Request is already ${u.verificationStatus}` });

    u.role               = "admin";
    u.verificationStatus = "approved";
    await u.save();

    res.json({ msg: `${u.name} has been approved as admin.`, user: { id: u._id, name: u.name, role: u.role } });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── REJECT ADMIN REQUEST ──────────────────────────────────────────────────────
// PUT /api/admin/reject/:id
exports.rejectAdmin = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ msg: "User not found" });

    if (u.verificationStatus !== "pending")
      return res.status(400).json({ msg: `Request is already ${u.verificationStatus}` });

    u.verificationStatus = "rejected";
    await u.save();

    res.json({ msg: `${u.name}'s admin request has been rejected.` });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};
