/**
 * feedbackJob.js
 * Runs every hour. Finds events that ended in the past hour and
 * sends a feedback request email to all registered students.
 * Uses feedbackSent flag on Event to prevent duplicate sends.
 */
const cron = require('node-cron');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const { sendFeedbackRequestEmail } = require('../services/emailService');

async function runFeedbackJob() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Events that ended in the last hour and haven't had feedback emails sent yet
    const events = await Event.find({
      date: { $gte: oneHourAgo, $lte: now },
      feedbackSent: false,
    });

    if (events.length === 0) return;
    console.log(`[FeedbackJob] ${events.length} event(s) ended — sending feedback requests`);

    const appUrl = process.env.APP_URL || '';

    for (const event of events) {
      const registrations = await Registration.find({ eventId: event._id });

      for (const reg of registrations) {
        try {
          const userDoc = await User.findById(reg.userId).lean();
          const email = (userDoc?.email || '').trim();
          if (!email) continue;

          await sendFeedbackRequestEmail(email, event, appUrl);
          console.log(`[FeedbackJob] Sent to ${email} for "${event.title}"`);
        } catch (err) {
          console.error(`[FeedbackJob] Failed for reg ${reg._id}: ${err.message}`);
        }
      }

      // Mark as sent so this event is never processed again
      await Event.findByIdAndUpdate(event._id, { feedbackSent: true });
    }
  } catch (err) {
    console.error('[FeedbackJob] Error:', err.message);
  }
}

// Run every hour at minute 30 (offset from reminderJob which runs at :00)
cron.schedule('30 * * * *', runFeedbackJob);
console.log('[FeedbackJob] Scheduled — runs every hour at :30');
