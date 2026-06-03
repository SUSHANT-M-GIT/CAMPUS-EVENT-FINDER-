const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const dotenv     = require("dotenv");
const cors       = require("cors");
const path       = require("path");
const connectDB  = require("./config/db");
const { startReminderScheduler } = require("./services/reminderScheduler");

dotenv.config();
connectDB();

const app    = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Expose io globally so controllers can emit events
global.io = io;

io.on("connection", (socket) => {
  // Each authenticated user joins a room named after their userId
  socket.on("join", (userId) => {
    if (userId) {
      socket.join(userId);
      socket.join("all"); // broadcast room — new events go here
    }
  });
  socket.on("disconnect", () => { /* cleanup handled by socket.io */ });
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.options("*", cors());
app.use(express.json());

// Serve uploaded files (banners, payment screenshots, QR codes)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",        require("./routes/authRoutes"));
app.use("/api/events",     require("./routes/eventRoutes"));
app.use("/api",            require("./routes/registrationRoutes"));
app.use("/api/admin",      require("./routes/adminRoutes"));
app.use("/api/feedback",   require("./routes/feedbackRoutes"));
app.use("/api/comments",   require("./routes/commentRoutes"));
app.use("/api",            require("./routes/debugRoutes"));
app.use("/api/payment",    require("./routes/paymentRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  startReminderScheduler();
});

// Start cron jobs (non-blocking)
require("./cronJobs/reminderJob");
require("./cronJobs/feedbackJob");
