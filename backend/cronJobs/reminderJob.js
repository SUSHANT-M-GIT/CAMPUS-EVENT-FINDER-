/**
 * cronJobs/reminderJob.js
 * Runs every hour. Sends a 24-hour reminder to registered users
 * whose event starts within the next 24 hours.
 * Uses reminderSent flag on Registration to prevent duplicates.
 */
const cron         = require("node-cron");
const Registration = require("../models/Registration");
const Event        = require("../models/Event");
const User         = require("../models/User");
const { sendReminderEmail } = require("../services/emailService");

async function runReminderJob() {
  console.log("[ReminderJob] Tick —", new Date().toISOString());
  try {
    const now    = new Date();
    const in24h  = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h  = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Events starting within the next 24–25 hour window
    const events = await Event.find({ date: { $gte: in24h, $lte: in25h } });
    console.log(`[ReminderJob] Events in window: ${events.length}`);

    for (const event of events) {
      // Only registrations that haven't been reminded yet
      const registrations = await Registration.find({
        eventId: event._id,
        reminderSent: false,
      });

      for (const reg of registrations) {
        try {
          // Resolve email: prefer stored reg.email, fall back to User record
          let recipientEmail = (reg.email || "").trim();
          let recipientName  = reg.name || "there";

          if (!recipientEmail) {
            const userDoc = await User.findById(reg.userId).lean();
            recipientEmail = (userDoc?.email || "").trim();
            recipientName  = userDoc?.name || recipientName;
          }

          if (!recipientEmail) {
            console.warn(`[ReminderJob] No email for registration ${reg._id} — skipping`);
            continue;
          }

          await sendReminderEmail(recipientEmail, event, { name: recipientName });

          // Mark as sent in DB so it never fires again
          await Registration.findByIdAndUpdate(reg._id, { reminderSent: true });
          console.log(`[ReminderJob] Reminder sent → "${recipientEmail}" for "${event.title}"`);

        } catch (err) {
          console.error(`[ReminderJob] Failed for reg ${reg._id}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error("[ReminderJob] Tick error:", err.message);
  }
}

// Run every hour at minute 0
cron.schedule("0 * * * *", runReminderJob);
console.log("[ReminderJob] Scheduled — runs every hour.");
