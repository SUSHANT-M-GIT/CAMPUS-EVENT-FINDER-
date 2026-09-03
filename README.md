# Campus Event Finder & Manager

A full-stack web application that helps students, professionals, and organizers discover, register for, and manage campus events — with QR-based attendance, certificates, real-time notifications, and a complete organizer dashboard.

---

## 🌐 Live App

**Frontend:** [https://c-e-s.vercel.app](https://c-e-s.vercel.app)

**Backend API:** [https://campus-event-finder-r2j3.onrender.com](https://campus-event-finder-r2j3.onrender.com)

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Auth | JWT, Google OAuth, Microsoft OAuth (MSAL v5) |
| Real-time | Socket.IO |
| Email | Brevo (primary), Gmail SMTP (fallback) |
| Deployment | Vercel (frontend), Render (backend) |

---

## 👤 Account Types

### Student
- Registers with college name and college ID
- Browses and registers for events
- Gets a QR code for attendance at each event
- Downloads attendance certificates after the event
- Can edit their name from the profile page
- Can change their password

### Working Professional
- Registers with designation and optional company name
- Same event access as students
- QR attendance and certificates included

### General / Individual
- For anyone who is not a student or professional
- No company or designation required
- Full event browsing and registration access

### Admin / Organizer
- Requires approval from the platform owner before access is granted
- Creates and manages events
- Scans QR codes to mark attendance
- Views all registrations for their events
- Enables certificates for events
- Manages waitlists and cancellations
- Gets real-time notifications when someone registers

---

## 🔐 Authentication

- **Email signup** — OTP email verification required
- **Google login** — new users complete their profile after OAuth
- **Microsoft login** — new users complete their profile after OAuth
- **Forgot password** — secure reset link sent to email (60 min expiry)
- **Change password** — from the profile page (authenticated)
- All routes are protected by JWT tokens

---

## 📁 Project Structure

```
Campus-Event-Finder/
├── frontend/                  # React + TypeScript app
│   ├── public/
│   │   └── auth-redirect.html # MSAL popup redirect page
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # React context providers
│   │   ├── pages/             # Full page components
│   │   ├── routes/            # App routing
│   │   ├── services/          # API call functions
│   │   ├── types/             # TypeScript type definitions
│   │   └── utils/             # Helper utilities
│   ├── vercel.json            # Vercel SPA routing config
│   └── .env                   # Frontend environment variables
│
└── backend/                   # Node.js + Express API
    ├── config/
    │   └── db.js              # MongoDB connection
    ├── controllers/           # Route handler logic
    ├── cronJobs/              # Scheduled background tasks
    ├── middleware/            # Auth, role, upload middleware
    ├── models/                # MongoDB schemas
    ├── routes/                # API route definitions
    ├── scripts/               # One-off utility scripts
    ├── services/              # Email, scheduler services
    ├── tests/                 # Backend test files
    └── server.js              # App entry point
```

---

## 🧩 Frontend Files

### Pages (`frontend/src/pages/`)

| File | What it does |
|---|---|
| `LandingPage.tsx` | Home page shown to visitors who are not logged in |
| `LoginPage.tsx` | Email login form with Google and Microsoft OAuth buttons |
| `SignupPage.tsx` | Account creation form — OTP verification step included |
| `ForgotPasswordPage.tsx` | Enter email to receive a password reset link |
| `ResetPasswordPage.tsx` | Set a new password using the reset link from email |
| `UserDashboardPage.tsx` | Main dashboard for students and professionals — browse and register for events |
| `UserProfilePage.tsx` | View profile info, edit name, change password |
| `MyRegistrationsPage.tsx` | View all event registrations, show QR codes, download certificates |
| `EventsPage.tsx` | Public event listing page |
| `EventDetailsPage.tsx` | Single event details page |
| `AdminDashboardPage.tsx` | Full organizer dashboard — events, attendance, registrations, notifications |
| `AdminEventsPage.tsx` | List of all events created by the organizer |
| `AdminEventFormPage.tsx` | Create or edit an event |
| `AdminEventRegistrationsPage.tsx` | View all registrations for a specific event |
| `OrganizerApprovalPage.tsx` | Page shown when platform owner clicks approve/reject link from email |
| `NotFoundPage.tsx` | 404 page |

### Components (`frontend/src/components/`)

| File | What it does |
|---|---|
| `SocialAuthButtons.tsx` | Google and Microsoft OAuth buttons with profile completion modal |
| `AppNavbar.tsx` | Top navigation bar shown inside the app |
| `Navbar.tsx` | Navigation bar shown on public pages |
| `ProtectedRoute.tsx` | Blocks pages from unauthenticated or wrong-role users |
| `QrScannerModal.tsx` | Admin QR scanner — camera scan, image upload, and manual ID entry |
| `NotificationBell.tsx` | Real-time notification bell in the admin navbar |
| `EventCard.tsx` | Single event card shown in listings |
| `EventCarousel.tsx` | Featured events horizontal carousel |
| `Alert.tsx` | Success and error alert banners |
| `LoadingSpinner.tsx` | Loading indicator |
| `SkeletonCard.tsx` | Placeholder card shown while events are loading |
| `EmptyState.tsx` | Shown when a list has no items |
| `ErrorBoundary.tsx` | Catches unexpected React errors gracefully |
| `DashboardLayout.tsx` | Shared layout wrapper for dashboard pages |
| `GoogleAuthButton.tsx` | Standalone Google login button (legacy component) |

### Context (`frontend/src/context/`)

| File | What it does |
|---|---|
| `AuthContext.tsx` | Stores logged-in user, JWT token, login/logout/signup/updateName functions |
| `ThemeContext.tsx` | Light and dark mode state and toggle |
| `SocketContext.tsx` | Socket.IO connection for real-time events |

### Services (`frontend/src/services/`)

| File | What it does |
|---|---|
| `authService.ts` | Login, signup, Google auth, Microsoft auth, update name, change password |
| `api.ts` | Central Axios instance — attaches JWT token to every request |
| `registrationService.ts` | Register for event, cancel registration, get my registrations |
| `attendanceService.ts` | Scan QR, get attendance list, get my QR, download certificate |
| `feedbackService.ts` | Submit and retrieve event feedback/ratings |
| `commentService.ts` | Post, get, and delete Q&A comments on events |

---

## 🧩 Backend Files

### Entry Point

| File | What it does |
|---|---|
| `server.js` | Starts Express, connects DB, sets up middleware, mounts all routes, starts Socket.IO and cron jobs |

### Routes (`backend/routes/`)

| File | API prefix | What it handles |
|---|---|---|
| `authRoutes.js` | `/api/auth` | Register, login, verify email, forgot/reset password, Google/Microsoft OAuth, get current user, update name |
| `eventRoutes.js` | `/api/events` | Get all events, get one event, create, update, delete |
| `registrationRoutes.js` | `/api` | Register for event, cancel, get my registrations, regenerate QR |
| `adminRoutes.js` | `/api/admin` | Admin user management, stats, audit logs |
| `attendanceRoutes.js` | `/api/attendance` | Scan QR, manual attendance, get attendance list, enable certificates, serve QR image |
| `feedbackRoutes.js` | `/api/feedback` | Submit feedback, get event feedback, get my feedback |
| `commentRoutes.js` | `/api/comments` | Add, get, delete comments (Q&A) |
| `uploadRoutes.js` | `/api/upload` | Upload event banner images |
| `debugRoutes.js` | `/api` | Health check and debug endpoints |

### Controllers (`backend/controllers/`)

| File | What it does |
|---|---|
| `authController.js` | All auth logic — registration, login, OTP, password reset, Google/Microsoft OAuth, name update, organizer approval |
| `eventController.js` | Create, read, update, delete events — with search and filtering |
| `registrationController.js` | Register users for events, generate QR codes, handle waitlists, send confirmation emails |
| `attendanceController.js` | Mark attendance via QR scan or manual ID, generate certificates, serve QR images |
| `adminController.js` | Platform-level admin actions — user management, stats, audit logs |
| `feedbackController.js` | Submit and retrieve star ratings and comments for events |
| `commentController.js` | Event Q&A thread — post and delete comments |

### Models (`backend/models/`)

| File | What it stores |
|---|---|
| `User.js` | All user accounts — name, email, role, college info, professional info, OAuth info, approval status |
| `Event.js` | Event details — title, date, location, type, capacity, banner, tags, certificates |
| `Registration.js` | Who registered for what — QR code, attendance status, waitlist position, certificate ID |
| `Feedback.js` | Star ratings and text reviews for events |
| `Comment.js` | Q&A comments and replies on event pages |
| `AuditLog.js` | Admin action history for accountability |

### Services (`backend/services/`)

| File | What it does |
|---|---|
| `emailService.js` | Sends all emails — registration confirmation (with inline QR), reminders, password reset, organizer approval/rejection |
| `reminderScheduler.js` | Checks for events happening in 24 hours and sends reminder emails |

### Cron Jobs (`backend/cronJobs/`)

| File | What it does |
|---|---|
| `reminderJob.js` | Runs daily — triggers reminder emails for tomorrow's events |
| `feedbackJob.js` | Runs after events end — prompts attendees to submit feedback |

### Middleware (`backend/middleware/`)

| File | What it does |
|---|---|
| `auth.js` | Verifies JWT token on protected routes |
| `role.js` | Checks if the user has the required role |
| `superAdmin.js` | Restricts routes to the platform super admin only |
| `projectOwner.js` | Restricts routes to the platform owner only |
| `upload.js` | Handles file uploads using Multer |

---

## 🗄️ Database — MongoDB Atlas

**Database:** `campus-events`

**Collections:**

| Collection | What's in it |
|---|---|
| `users` | All accounts — students, professionals, admins |
| `events` | All events created by organizers |
| `registrations` | All event registrations with QR codes |
| `feedbacks` | Star ratings and reviews |
| `comments` | Q&A threads on events |
| `auditlogs` | Admin action history |

---

## 🌍 Environment Variables

### Backend (set on Render)

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 5000) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `FRONTEND_URL` | Deployed frontend URL — used in password reset emails |
| `BACKEND_URL` | Deployed backend URL — used for QR image URLs |
| `PLATFORM_OWNER_EMAIL` | Email that receives organizer approval requests |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `BREVO_SENDER` | Sender email address for Brevo |
| `EMAIL_PROVIDER` | Set to `brevo` to use Brevo |

### Frontend (set on Vercel)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API URL — `https://campus-event-finder-r2j3.onrender.com/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VITE_MICROSOFT_CLIENT_ID` | Microsoft Azure app client ID |

---

## 🚀 Running Locally

### Backend
```bash
cd backend
npm install
# create .env with the variables listed above
npm start
```

### Frontend
```bash
cd frontend
npm install
# create .env with VITE_* variables
npm run dev
```

Frontend runs on `http://localhost:5173`
Backend runs on `http://localhost:5000`

---

## 🔒 Security

- Passwords hashed with bcrypt
- JWT tokens expire in 24 hours
- OTP email verification for new accounts
- NoSQL injection protection via express-mongo-sanitize
- Rate limiting — 100 requests per minute per IP
- Security headers via Helmet
- Organizer accounts require platform owner approval before access
- Name update endpoint cannot change role or permissions
- OAuth identity verified server-side (Google token / Microsoft Graph API)

---

*Built by Sushant Mishra*
