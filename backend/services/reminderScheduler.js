const cron         = require("node-cron");
const Registration = require("../models/Registration");
const Event        = require("../models/Event");
const User         = require("../models/User");
const { sendReminderEmail } = require("./emailService");

// Tracks sent reminders within this server session to prevent duplicates.
// Key: `${registrationId}_${type}`
const sentLog = new Set();

async function processReminders() {
  const now   = new Date();
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  try {
    const upcomingEvents = await Event.find({ date: { $gte: now, $lte: in25h } });

    for (const event of upcomingEvents) {
      const hoursUntil = (new Date(event.date) - now) / (1000 * 60 * 60);

      let reminderType = null;
      if      (hoursUntil <= 25  && hoursUntil > 23) reminderType = "24h";
      else if (hoursUntil <= 1.1 && hoursUntil > 0)  reminderType = "1h";
      if (!reminderType) continue;

      const registrations = await Registration.find({ eventId: event._id });

      for (const reg of registrations) {
        const key = `${reg._id}_${reminderType}`;
        if (sentLog.has(key)) continue;

        // Prefer email stored on the registration; fall back to the User record.
        // (Frontend sends no payload so reg.email is often null.)
        let recipientEmail = (reg.email || "").trim();
        let recipientName  = reg.name || "there";

        if (!recipientEmail) {
          const userDoc = await User.findById(reg.userId).lean();
          recipientEmail = (userDoc?.email || "").trim();
          recipientName  = userDoc?.name   || recipientName;
        }

        if (!recipientEmail) {
          console.warn(`[Reminder] No email for registration ${reg._id} — skipping`);
          continue;
        }

        try {
          await sendReminderEmail(recipientEmail, event, { name: recipientName }, reminderType);
          sentLog.add(key);
          console.log(`[Reminder] ${reminderType} sent → "${recipientEmail}" for "${event.title}"`);
        } catch (err) {
          console.error(`[Reminder] ${reminderType} FAILED → "${recipientEmail}": ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error("[Reminder] Scheduler tick error:", err.message);
  }
}

function startReminderScheduler() {
  console.log("[Reminder] Scheduler started — runs every 5 minutes.");
  cron.schedule("*/5 * * * *", processReminders);
}

module.exports = { startReminderScheduler };
