const Feedback = require('../models/Feedback');
const Event = require('../models/Event');
const Registration = require('../models/Registration');

exports.submitFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const { eventId } = req.params;

    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ msg: 'Rating must be between 1 and 5' });

    // Only registered users can leave feedback
    const reg = await Registration.findOne({ eventId, userId: req.user.id });
    if (!reg)
      return res
        .status(403)
        .json({ msg: 'You must be registered for this event to leave feedback' });

    // Event must have already ended
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ msg: 'Event not found' });
    if (new Date(event.date) > new Date())
      return res
        .status(400)
        .json({ msg: 'Feedback can only be submitted after the event has ended' });

    // Save feedback (unique index prevents duplicates)
    await new Feedback({
      eventId,
      userId: req.user.id,
      rating,
      comment: comment?.trim() || '',
    }).save();

    // Recalculate and update avgRating + feedbackCount on the Event document
    const agg = await Feedback.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (agg.length > 0) {
      await Event.findByIdAndUpdate(eventId, {
        avgRating: Math.round(agg[0].avg * 10) / 10, // 1 decimal place
        feedbackCount: agg[0].count,
      });
    }

    res.json({ msg: 'Thank you for your feedback!' });
  } catch (e) {
    if (e.code === 11000)
      return res.status(400).json({ msg: 'You have already submitted feedback for this event' });
    console.error('submitFeedback error:', e.message);
    res.status(500).json({ msg: e.message || 'Server error' });
  }
};

// ── GET FEEDBACK FOR AN EVENT (admin only) ────────────────────────────────────
// GET /api/feedback/:eventId
exports.getEventFeedback = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify the requesting admin owns this event
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ msg: 'Event not found' });
    if (event.createdBy.toString() !== req.user.id)
      return res.status(403).json({ msg: 'Forbidden: you do not own this event' });

    const feedbacks = await Feedback.find({ eventId })
      .populate('userId', 'name email collegeName')
      .sort({ submittedAt: -1 });

    res.json({
      avgRating: event.avgRating,
      feedbackCount: event.feedbackCount,
      feedbacks,
    });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── CHECK IF USER HAS SUBMITTED FEEDBACK ─────────────────────────────────────
// GET /api/feedback/:eventId/mine
exports.myFeedback = async (req, res) => {
  try {
    const fb = await Feedback.findOne({ eventId: req.params.eventId, userId: req.user.id });
    res.json(fb || null);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};
