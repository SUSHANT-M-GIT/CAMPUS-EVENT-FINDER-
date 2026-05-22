const express = require("express");
const dotenv  = require("dotenv");
const cors    = require("cors");
const path    = require("path");
const connectDB = require("./config/db");
const { startReminderScheduler } = require("./services/reminderScheduler");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.options("*", cors());

app.use(express.json());

// Serve uploaded event banners as static files
// e.g. GET /uploads/event-banners/abc123.png
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth",     require("./routes/authRoutes"));
app.use("/api/events",   require("./routes/eventRoutes"));
app.use("/api",          require("./routes/registrationRoutes"));
app.use("/api/admin",    require("./routes/adminRoutes"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/comments", require("./routes/commentRoutes"));
app.use("/api",          require("./routes/debugRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
  startReminderScheduler();
});

// Start cron jobs (non-blocking)
require("./cronJobs/reminderJob");
require("./cronJobs/feedbackJob");
