const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const { startReminderScheduler } = require('./services/reminderScheduler');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Enable trust proxy for cloud deployment (Render, Vercel, Railway load balancers)
app.set('trust proxy', 1);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Expose io globally so controllers can emit events
global.io = io;

io.on('connection', (socket) => {
  // Each authenticated user joins a room named after their userId
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId);
      socket.join('all'); // broadcast room — new events go here
    }
  });
  socket.on('disconnect', () => {
    /* cleanup handled by socket.io */
  });
});

// ── Middleware ───────────────────────────────────────────────────────────────
// Security headers
app.use(helmet({ contentSecurityPolicy: false }));
// Rate limiting — 100 requests per minute per IP
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: { msg: 'Too many requests, please try again later.' },
  })
);
// NoSQL injection protection
app.use(mongoSanitize());

const allowedOrigins = [
  'https://c-e-s.vercel.app',
  'https://campus-event-finder-pgguchles-sushant-m-gits-projects.vercel.app',
  'https://campus-event-finder-r2j3.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

function checkCorsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.onrender.com') ||
    origin.endsWith('.railway.app') ||
    origin.endsWith('.up.railway.app')
  ) return callback(null, true);
  if (process.env.APP_URL && origin === process.env.APP_URL.replace(/\/$/, '')) return callback(null, true);
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL.replace(/\/$/, '')) return callback(null, true);
  callback(null, true); // Allow all — specific blocking handled by auth middleware
}

app.use(
  cors({
    origin: checkCorsOrigin,
    credentials: true,
  })
);
app.options('*', cors({
  origin: checkCorsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Serve uploaded files (banners, QR codes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api', require('./routes/registrationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api', require('./routes/debugRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  startReminderScheduler();
});

// Start cron jobs (non-blocking)
require('./cronJobs/reminderJob');
require('./cronJobs/feedbackJob');
