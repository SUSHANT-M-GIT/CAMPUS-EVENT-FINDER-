const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    teamName: { type: String, required: true, trim: true },
    teamCode: { type: String, required: true, unique: true, trim: true },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    minTeamSize: { type: Number, required: true },
    maxTeamSize: {
      type: Number,
      required: true,
      validate: {
        validator: function (value) {
          return value >= this.minTeamSize;
        },
        message: 'Maximum team size must be greater than or equal to minimum team size',
      },
    },
    status: { type: String, enum: ['forming', 'ready'], default: 'forming' },
  },
  { timestamps: true }
);

teamSchema.index({ event: 1, leader: 1 });

module.exports = mongoose.model('Team', teamSchema);