const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: { type: String, enum: ['hackathon', 'tech', 'seminar', 'games', 'movie', 'other'] },
    date: Date,
    time: String,
    registrationDeadline: Date,
    location: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    maxRegistrations: { type: Number, default: 100 },
    registrationCount: { type: Number, default: 0 },
    eligibility: { type: String, enum: ['all', 'own_college'], default: 'all' },

    // Feature 1: Tags — stored lowercase for case-insensitive search
    tags: {
      type: [String],
      default: [],
      set: (arr) => arr.map((t) => t.trim().toLowerCase()).filter(Boolean),
    },

    // Feedback aggregates — updated whenever a new feedback is submitted
    avgRating: { type: Number, default: 0 },
    feedbackCount: { type: Number, default: 0 },
    feedbackSent: { type: Boolean, default: false },

    // Banner image
    bannerImage: { type: String, default: '' }, // local path or Google Drive direct URL
    bannerSource: { type: String, enum: ['local', 'gdrive', ''], default: '' },

    // ── Certificate control ───────────────────────────────────────────────────
    certificatesEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Text index for fast full-text search on title, description, tags
eventSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Regular index on tags for $in queries (similar events)
eventSchema.index({ tags: 1 });

module.exports = mongoose.model('Event', eventSchema);
