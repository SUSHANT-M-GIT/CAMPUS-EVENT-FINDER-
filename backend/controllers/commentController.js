const Comment = require("../models/Comment");
const Event   = require("../models/Event");

// ── GET comments for an event ─────────────────────────────────────────────────
// GET /api/comments/:eventId
// Returns top-level comments with their replies nested inside.
exports.getComments = async (req, res) => {
  try {
    const all = await Comment.find({ eventId: req.params.eventId })
      .populate("userId", "name role collegeName")
      .sort({ createdAt: 1 })
      .lean();

    // Nest replies under their parent
    const topLevel = all.filter(c => !c.parentId);
    const replies  = all.filter(c =>  c.parentId);

    const threaded = topLevel.map(c => ({
      ...c,
      replies: replies.filter(r => r.parentId?.toString() === c._id.toString()),
    }));

    res.json(threaded);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── POST a comment or reply ───────────────────────────────────────────────────
// POST /api/comments/:eventId
// Body: { text, parentId? }
exports.addComment = async (req, res) => {
  try {
    const { text, parentId } = req.body;
    if (!text?.trim()) return res.status(400).json({ msg: "Comment text is required" });

    // Verify event exists
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ msg: "Event not found" });

    // If replying, verify parent exists and belongs to same event
    if (parentId) {
      const parent = await Comment.findById(parentId);
      if (!parent || parent.eventId.toString() !== req.params.eventId)
        return res.status(400).json({ msg: "Invalid parent comment" });
      // Only allow one level of nesting (replies to replies not allowed)
      if (parent.parentId) return res.status(400).json({ msg: "Cannot reply to a reply" });

      // Only the event admin can reply
      const isEventAdmin = event.createdBy.toString() === req.user.id;
      if (!isEventAdmin)
        return res.status(403).json({ msg: "Only the event organiser can reply to questions" });
    }

    const comment = await new Comment({
      eventId:  req.params.eventId,
      userId:   req.user.id,
      text:     text.trim(),
      parentId: parentId || null,
    }).save();

    // Return populated comment
    const populated = await Comment.findById(comment._id)
      .populate("userId", "name role collegeName")
      .lean();

    res.status(201).json({ ...populated, replies: [] });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── DELETE a comment ──────────────────────────────────────────────────────────
// DELETE /api/comments/:commentId
// Only the author or the event's admin can delete.
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId).populate("eventId");
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const isAuthor = comment.userId.toString() === req.user.id;
    const isEventAdmin = comment.eventId?.createdBy?.toString() === req.user.id;

    if (!isAuthor && !isEventAdmin)
      return res.status(403).json({ msg: "Not authorised to delete this comment" });

    // Also delete any replies to this comment
    await Comment.deleteMany({ parentId: comment._id });
    await Comment.findByIdAndDelete(comment._id);

    res.json({ msg: "Deleted" });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};
