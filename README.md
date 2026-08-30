# 🎓 Campus Event Finder & Manager

A modern, full-stack, enterprise-ready campus event discovery, management, and attendance platform built with **Node.js, Express, MongoDB, React, TypeScript, and Vite**.

The platform streamlines the complete lifecycle of campus events: from event publishing, student registrations, and automated QR ticket delivery to camera-based QR attendance scanning, live attendance dashboards, verified PDF certificates, and a secure **1-Click Platform Owner Email Approval System** for event organizers.

---

## 🌟 Key Features

### 1. 🔐 Multi-Role Authentication & Access Control
- **Student Profile**: Registration with College/University Name and College ID / Roll Number.
- **Working Professional Profile**: Registration with Job Title / Designation and Company/Organisation.
- **Event Organizer / Admin Profile**: Dedicated verification workflow requiring Organization/Club name and Contact Phone Number.
- **Social OAuth Single Sign-On (SSO)**:
  - **Google OAuth**: Fast credential flow via official Google Identity services.
  - **Microsoft OAuth**: Azure App Registration integration supporting university Microsoft 365 and personal Microsoft accounts.
  - **Profile Completion Modal**: Automatically prompts new OAuth users to complete mandatory profile details before account activation.

### 2. ⚡ 1-Click Platform Owner Email Approval System
- **Verification Gate**: New Admin / Organizer accounts start in `pending` status and cannot access organizer management until approved.
- **Instant Email Delivery**: The Platform Owner receives a formatted email with the organizer's credentials (Full Name, Email, Phone Number, College, Club Name, Designation).
- **Zero-Friction Decision**: The owner can approve or reject the request directly from their email client using single-tap **`[ 🟢 APPROVE ORGANIZER ]`** and **`[ ❌ REJECT ]`** buttons.
- **Cryptographic Security**: Each link is secured by a 256-bit cryptographic token (hashed with SHA-256) with a 24-hour expiration window.
- **Replay Protection**: Single-use token invalidation prevents reuse of clicked links.
- **Live Notifications**: Automated email notifications are sent to the organizer upon approval or rejection.
- **Interactive UI Dashboard**: Branded web confirmation pages for instant feedback.

### 3. 📅 Event Discovery & Management
- **Rich Event Creation**: Organizers can publish events with title, description, category, banners, venue, date/time, registration deadlines, and seat capacity.
- **Dynamic Search & Filters**: Search events by keywords, filter by category/tags, and toggle between Upcoming, Ongoing, and Completed events.
- **Real-Time Live Updates**: Instant state synchronization powered by **Socket.IO**.

### 4. 🎟️ Registration & QR Attendance System
- **Instant Registration**: One-click event registration with real-time seat tracking.
- **Automated QR Ticket Email**: Sends confirmation emails with an embedded personalized QR code attachment.
- **In-Browser Camera QR Scanner**: Organizers can open a camera scanner to scan student QR codes in real time.
- **Live Attendance Roster**: Real-time attendance counters, attendance status toggles, and attendance roster exports.

### 5. 📜 Verified PDF Certificates
- **Automated Certificate Generation**: Organizers can enable certificate generation for attended participants.
- **Direct PDF Download**: Students who attended can generate and download their customized, tamper-proof completion certificates generated server-side using **PDFKit**.

---

## 🛠️ Tech Stack

### Frontend
- **Framework & Language**: React 18, TypeScript
- **Build Tool**: Vite (with built-in API proxy to Express backend)
- **Styling**: Modern CSS3, TailwindCSS, CSS Modules
- **Icons & Animations**: Lucide Icons, Canvas Confetti
- **QR Scanner**: `html5-qrcode`
- **OAuth Providers**: `@react-oauth/google`, `@azure/msal-browser`

### Backend
- **Runtime & Framework**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-Time**: Socket.IO
- **Security & Hashing**: `bcryptjs`, `jsonwebtoken` (JWT), `crypto` (SHA-256 tokens)
- **Email Delivery**: Nodemailer (Gmail SMTP / Custom SMTP)
- **QR Code Engine**: `qrcode`
- **PDF Generation**: `pdfkit`
- **Testing**: Jest, Supertest

---

## 📁 Project Architecture

```text
Campus-Event-Finder/
├── backend/
│   ├── config/             # Database connection & server configuration
│   ├── controllers/        # Business logic (auth, events, attendance, registrations)
│   ├── cronJobs/           # Automated background maintenance tasks
│   ├── middleware/         # JWT auth, role validation & normalization
│   ├── models/             # Mongoose schemas (User, Event, Registration)
│   ├── routes/             # Express API route declarations
│   ├── services/           # Email service, QR generation & certificate PDF engine
│   ├── tests/              # Jest unit & integration test suites
│   ├── uploads/            # Local storage for QR codes & uploaded assets
│   ├── .env.example        # Environment variable template
│   ├── package.json        # Backend dependencies & scripts
│   └── server.js           # Express app entrypoint & Socket.IO server
│
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components (Modals, Navbars, QR Scanner, Alerts)
│   │   ├── context/        # Auth, Theme, and Socket context providers
│   │   ├── pages/          # Landing, Dashboards, Auth, Profile, and Approval pages
│   │   ├── routes/         # React Router configurations & Protected Routes
│   │   ├── services/       # Axios API client modules
│   │   ├── types/          # TypeScript interfaces & types
│   │   └── utils/          # Formatting & error handling utilities
│   ├── public/             # Static public assets
│   ├── index.html          # HTML5 entrypoint
│   ├── package.json        # Frontend dependencies & scripts
│   └── vite.config.ts      # Vite configuration & dev API proxy
│
└── README.md
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# ─── Server ───────────────────────────────────────────────────────────────────
PORT=5000

# ─── MongoDB ──────────────────────────────────────────────────────────────────
# Local MongoDB: mongodb://127.0.0.1:27017/campus-events
# MongoDB Atlas: mongodb+srv://<user>:<password>@cluster.mongodb.net/campus-events
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/campus-events?retryWrites=true&w=majority

# ─── JWT Secret ───────────────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_here

# ─── Platform Owner & Super Admin ─────────────────────────────────────────────
# Email where 1-Click Organizer Approval requests will be delivered
PLATFORM_OWNER_EMAIL=your_owner_email@example.com
SUPER_ADMIN_EMAIL=your_owner_email@example.com

# ─── OAuth Credentials ────────────────────────────────────────────────────────
# Google OAuth Client ID
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Microsoft OAuth Client ID (Azure App Registration)
MICROSOFT_CLIENT_ID=your_microsoft_client_id

# ─── Email Configuration (Nodemailer SMTP) ───────────────────────────────────
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=Campus Event Finder <noreply@campuseventfinder.com>

# ─── App URL (used in email links) ────────────────────────────────────────────
APP_URL=http://localhost:5173
```

Create a `.env` file in the `frontend/` directory (optional for OAuth):

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id
```

---

## 🚀 Installation & Running Locally

### 1. Clone the repository
```bash
git clone https://github.com/SUSHANT-M-GIT/CAMPUS-EVENT-FINDER-.git
cd Campus-event-Finder-and-Manager-clean-branch
```

### 2. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Start Development Servers

**Terminal 1 — Start Backend Server (Port 5000):**
```bash
cd backend
npm run dev
```

**Terminal 2 — Start Frontend Server (Port 5173):**
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Automated Tests

```bash
# Run all backend test suites (33 tests covering Auth, Approval, QR Attendance, OAuth)
cd backend
npm test

# Verify frontend TypeScript build
cd ../frontend
npm run build
```

---

## 📡 API Overview

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | User & Organizer registration with OTP verification | Public |
| `POST` | `/api/auth/verify-email` | Verify email OTP & trigger organizer approval | Public |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT | Public |
| `POST` | `/api/auth/google` | Google OAuth token verification & login/signup | Public |
| `POST` | `/api/auth/microsoft` | Microsoft OAuth token verification & login/signup | Public |
| `GET` | `/api/auth/organizer-approval/approve/:token` | 1-Click cryptographic organizer approval | Public (Token Auth) |
| `GET` | `/api/auth/organizer-approval/reject/:token` | 1-Click cryptographic organizer rejection | Public (Token Auth) |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Authenticated |
| `GET` | `/api/events` | Browse event listings with search/filter | Public / Authenticated |
| `POST` | `/api/events` | Create a new campus event | Admin / Organizer |
| `POST` | `/api/registrations/register/:eventId` | Register for an event & receive QR ticket | Student / Professional |
| `POST` | `/api/attendance/scan` | Scan QR code to mark attendance | Admin / Organizer |
| `GET` | `/api/attendance/certificate/:eventId` | Download participant PDF certificate | Attended Participant |

---

## 🛡️ Security & Reliability Features

- **SHA-256 One-Time Approval Tokens**: Protects organizer approval links against replay attacks.
- **Strict Role Normalization**: Prevents unauthorized API access across admin and participant roles.
- **Environment Isolation**: Production-ready environment variable configurations.
- **Input Sanitization & Validation**: Server-side validation for all incoming payloads.
- **Rate-Limiting & Error Boundaries**: Prevents crashes and protects endpoints from abuse.

---

## 📄 License

This project is open-source and available under the **MIT License**.
