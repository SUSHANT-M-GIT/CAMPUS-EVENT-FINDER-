const path     = require("path");
const fs       = require("fs");
const Event        = require("../models/Event");
const User         = require("../models/User");
const Registration = require("../models/Registration");
const { sendNewEventAnnouncement, sendEventCancellationEmail } = require("../services/emailService");

// ── Google Drive link helper ──────────────────────────────────────────────────
// Converts a share link like https://drive.google.com/file/d/FILE_ID/view
// into a direct embed URL: https://drive.google.com/uc?id=FILE_ID
function parseGdriveLink(link) {
  if (!link) return null;
  // Match /file/d/<ID>/ pattern
  const match = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?id=${match[1]}`;
  // Already a direct uc?id= link
  if (link.includes("drive.google.com/uc?id=")) return link;
  return null;
}

// ── Build banner fields from request ─────────────────────────────────────────
// Called by both createEvent and updateEvent.
// Now reads from req.files (fields upload) — req.files["image"]?.[0]
// Returns { bannerImage, bannerSource } or {} if nothing provided.
function extractBannerFields(req) {
  // 1. File uploaded via multer fields
  const imageFile = req.files?.["image"]?.[0];
  if (imageFile) {
    return {
      bannerImage:  `/uploads/event-banners/${imageFile.filename}`,
      bannerSource: "local",
    };
  }

  // 2. Google Drive link in body
  const gdriveLink = req.body.gdriveLink?.trim();
  if (gdriveLink) {
    const direct = parseGdriveLink(gdriveLink);
    if (!direct) return { _gdriveError: "Invalid Google Drive link format. Use: https://drive.google.com/file/d/FILE_ID/view" };
    return { bannerImage: direct, bannerSource: "gdrive" };
  }

  return {};
}

// ── Extract QR code field from request ───────────────────────────────────────
function extractQrFields(req) {
  const qrFile = req.files?.["qrImage"]?.[0];
  if (qrFile) {
    return { qrImage: `/uploads/qr-codes/${qrFile.filename}` };
  }
  return {};
}

// ── CREATE EVENT ──────────────────────────────────────────────────────────────
exports.createEvent = async (req, res) => {
  try {
    const banner   = extractBannerFields(req);
    if (banner._gdriveError) return res.status(400).json({ msg: banner._gdriveError });
    const qrFields = extractQrFields(req);

    // Strip non-model fields from body before spreading
    const { gdriveLink, ...bodyFields } = req.body;

    // Parse isPaid / price properly from FormData strings
    if (bodyFields.isPaid !== undefined) bodyFields.isPaid = bodyFields.isPaid === "true" || bodyFields.isPaid === true;
    if (bodyFields.price  !== undefined) bodyFields.price  = Number(bodyFields.price) || 0;
    // Parse refund policy fields
    if (bodyFields.refundAllowed     !== undefined) bodyFields.refundAllowed     = bodyFields.refundAllowed === "true" || bodyFields.refundAllowed === true;
    if (bodyFields.refundPercentage  !== undefined) bodyFields.refundPercentage  = Number(bodyFields.refundPercentage) || 100;
    if (bodyFields.refundCutoffHours !== undefined) bodyFields.refundCutoffHours = Number(bodyFields.refundCutoffHours) || 48;

    const e = new Event({ ...bodyFields, ...banner, ...qrFields, createdBy: req.user.id });
    await e.save();
    res.json(e);

    // Real-time notification — broadcast to all connected users
    if (global.io) {
      global.io.to("all").emit("newEvent", {
        _id:   e._id,
        title: e.title,
        type:  e.type,
        date:  e.date,
        message: `📢 New Event Added: ${e.title}`,
      });
    }

    // Fire-and-forget announcement email
    (async () => {
      try {
        const users  = await User.find({ role: "student" }, "email").lean();
        const emails = [...new Set(users.map(u => u.email).filter(v => v?.includes("@")))];
        console.log(`[Email] New event "${e.title}" — ${emails.length} recipient(s)`);
        await sendNewEventAnnouncement(emails, e, process.env.APP_URL || "");
      } catch (err) {
        console.error("[Email] Announcement error:", err.message);
      }
    })();
  } catch (err) {
    console.error("createEvent error:", err.message);
    res.status(500).json({ msg: err.message || "Server error" });
  }
};

// ── GET EVENTS ────────────────────────────────────────────────────────────────
exports.getEvents = async (req, res) => {
  try {
    const { type, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const baseFilter = { registrationDeadline: { $gte: new Date() } };
    if (type) baseFilter.type = type;

    let events = [];

    if (search && search.trim()) {
      const term = search.trim();
      const searchRegex = { $regex: term, $options: "i" };
      const searchFilter = {
        ...baseFilter,
        $or: [{ title: searchRegex }, { description: searchRegex }, { tags: searchRegex }],
      };
      events = await Event.find(searchFilter).sort({ registrationDeadline: 1 }).skip(skip).limit(parseInt(limit));

      if (events.length === 0) {
        const similarEvents = await getSimilarEvents(term, baseFilter, parseInt(limit));
        return res.json({ message: `Could not find events matching "${term}"`, similarEvents });
      }
    } else {
      events = await Event.find(baseFilter).sort({ registrationDeadline: 1 }).skip(skip).limit(parseInt(limit));
    }

    res.json(events);
  } catch (err) {
    console.error("getEvents error:", err.message);
    res.status(500).json({ msg: err.message || "Server error" });
  }
};

async function getSimilarEvents(searchTerm, baseFilter, limit = 5) {
  const keywords = searchTerm.split(/\s+/).filter(k => k.length > 2).map(k => k.toLowerCase());
  if (keywords.length === 0) return [];
  const keywordConditions = keywords.flatMap(kw => [
    { tags: { $regex: kw, $options: "i" } },
    { title: { $regex: kw, $options: "i" } },
  ]);
  return Event.find({ ...baseFilter, $or: keywordConditions }).sort({ registrationDeadline: 1 }).limit(limit);
}

// ── GET EVENT BY ID ───────────────────────────────────────────────────────────
exports.getEventById = async (req, res) => {
  try {
    const e = await Event.findById(req.params.id);
    if (!e) return res.status(404).json({ msg: "Not found" });
    res.json(e);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ── UPDATE EVENT ──────────────────────────────────────────────────────────────
exports.updateEvent = async (req, res) => {
  try {
    const e = await Event.findById(req.params.id);
    if (!e) return res.status(404).json({ msg: "Not found" });
    if (e.createdBy.toString() !== req.user.id)
      return res.status(403).json({ msg: "Forbidden: you do not own this event" });

    const banner   = extractBannerFields(req);
    if (banner._gdriveError) return res.status(400).json({ msg: banner._gdriveError });
    const qrFields = extractQrFields(req);

    // If a new local banner was uploaded, delete the old local file
    const newImageFile = req.files?.["image"]?.[0];
    if (newImageFile && e.bannerSource === "local" && e.bannerImage) {
      const oldPath = path.join(__dirname, "..", e.bannerImage);
      fs.unlink(oldPath, err => { if (err) console.warn("[Upload] Could not delete old banner:", err.message); });
    }

    const { gdriveLink, ...bodyFields } = req.body;
    // Parse boolean / numeric fields from FormData strings
    if (bodyFields.isPaid !== undefined) bodyFields.isPaid = bodyFields.isPaid === "true" || bodyFields.isPaid === true;
    if (bodyFields.price  !== undefined) bodyFields.price  = Number(bodyFields.price) || 0;
    // Parse refund policy fields
    if (bodyFields.refundAllowed     !== undefined) bodyFields.refundAllowed     = bodyFields.refundAllowed === "true" || bodyFields.refundAllowed === true;
    if (bodyFields.refundPercentage  !== undefined) bodyFields.refundPercentage  = Number(bodyFields.refundPercentage) || 100;
    if (bodyFields.refundCutoffHours !== undefined) bodyFields.refundCutoffHours = Number(bodyFields.refundCutoffHours) || 48;
    if (bodyFields.maxRegistrations  !== undefined) bodyFields.maxRegistrations  = Number(bodyFields.maxRegistrations) || 100;
    // Handle tags[] from FormData — ensure it's always an array
    if (bodyFields["tags[]"]) {
      bodyFields.tags = Array.isArray(bodyFields["tags[]"]) ? bodyFields["tags[]"] : [bodyFields["tags[]"]];
      delete bodyFields["tags[]"];
    } else if (bodyFields.tags && !Array.isArray(bodyFields.tags)) {
      bodyFields.tags = [bodyFields.tags];
    }
    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      { ...bodyFields, ...banner, ...qrFields },
      { new: true, runValidators: false }  // disable validators so existing past-deadline events can still be updated
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ── DELETE EVENT ──────────────────────────────────────────────────────────────
exports.deleteEvent = async (req, res) => {
  try {
    const e = await Event.findById(req.params.id);
    if (!e) return res.status(404).json({ msg: "Not found" });
    if (e.createdBy.toString() !== req.user.id)
      return res.status(403).json({ msg: "Forbidden: you do not own this event" });

    const reason = req.body?.reason?.trim() || "";
    await Event.findByIdAndDelete(req.params.id);

    // Delete local banner file if it exists
    if (e.bannerSource === "local" && e.bannerImage) {
      const filePath = path.join(__dirname, "..", e.bannerImage);
      fs.unlink(filePath, err => { if (err) console.warn("[Upload] Could not delete banner:", err.message); });
    }

    res.json({ msg: "Deleted" });

    // Fire-and-forget cancellation emails
    (async () => {
      try {
        const registrations = await Registration.find({ eventId: req.params.id }).lean();
        if (registrations.length === 0) return;
        const userIds  = [...new Set(registrations.map(r => r.userId.toString()))];
        const users    = await User.find({ _id: { $in: userIds } }, "email name").lean();
        const emailMap = Object.fromEntries(users.map(u => [u._id.toString(), u.email]));
        console.log(`[Email] Cancellation notices for "${e.title}" → ${userIds.length} student(s)`);
        for (const userId of userIds) {
          const email = emailMap[userId];
          if (email) await sendEventCancellationEmail(email, e, reason);
        }
        await Registration.deleteMany({ eventId: req.params.id });
      } catch (err) {
        console.error("[Email] Cancellation notification error:", err.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
