/**
 * One-time script to sync registrationCount on all events
 * from the actual number of Registration documents in the DB.
 *
 * Run once: node fixRegistrationCounts.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Event    = require("./models/Event");
const Registration = require("./models/Registration");

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const events = await Event.find({});
  console.log(`Found ${events.length} events`);

  for (const event of events) {
    const count = await Registration.countDocuments({ eventId: event._id });
    await Event.findByIdAndUpdate(event._id, { registrationCount: count });
    console.log(`✅ "${event.title}" → registrationCount set to ${count}`);
  }

  console.log("\nDone! All registration counts are now accurate.");
  await mongoose.disconnect();
}

fix().catch(err => { console.error(err); process.exit(1); });
