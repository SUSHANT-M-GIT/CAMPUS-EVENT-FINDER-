# 🎓 Campus Event Finder & Manager

A modern, full-stack campus event discovery, management, and attendance platform built with **Node.js, Express, MongoDB, React, TypeScript, and Vite**.

The platform covers the complete event lifecycle — from publishing and student registration to QR-based attendance scanning, live dashboards, PDF certificates, and a secure 1-click organizer approval system.

---

## 🌐 Live Deployment

| Service | URL |
| :--- | :--- |
| **Frontend** | https://c-e-s.vercel.app |
| **Backend API** | https://campus-event-finder-r2j3.onrender.com |

---

## 🌟 Key Features

### 🔐 Multi-Role Authentication
- Student, Working Professional, and Event Organizer / Admin roles
- Email + password signup with OTP verification
- Google OAuth (credential flow)
- Microsoft OAuth (Azure App Registration — supports university Microsoft 365 and personal accounts)
- Profile completion modal for OAuth users missing required fields

### ⚡ 1-Click Organizer Approval
- New organizer accounts start as `pending` and cannot publish events until approved
- Platform owner receives a formatted approval email with applicant details
- One-tap approve / reject buttons directly from the email — no dashboard login required
- SHA-256 cryptographic tokens with 24-hour expiry and single-use invalidation

### 📅 Event Management
- Rich event creation: title, description, category, banner, venue, date/time, deadline, capacity
- Search by keyword, filter by category/tags
- Real-time updates via Socket.IO

### 🎟️ Registration & QR Attendance
- One-click event registration with real-time seat tracking and waitlist
- Personalized QR code generated immediately on registration
- QR served via hosted backend endpoint — works reliably in all email clients (Gmail, Outlook)
- In-browser live camera QR scanner for organizers
- Manual registration code (REG-XXXXXX) as scanner fallback
- Live attendance roster

### 📜 PDF Certificates
- Organizer-controlled per-event certificate toggle
- Verified PDF certificates generated server-side with PDFKit
- Direct download for attended participants

### 📧 Reliable Email Delivery
- Brevo API (primary) with Resend and Gmail SMTP as fallbacks
- Password reset emails with Brevo click-tracking disabled (prevents broken links)
- Registration confirmation emails with embedded QR image

---

## 🛠️ Tech Stack

### Frontend
- React 19, TypeScript, Vite
- TailwindCSS + custom CSS design tokens (dark/light theme)
- Lucide Icons, Framer Motion
- `@react-oauth/google`, `@azure/msal-browser`
- Socket.IO client, Recharts, React Router v7

### Backend
- Node.js, Express.js
- MongoDB + Mongoose
- Socket.IO
- `bcryptjs`, `jsonwebtoken`, `crypto`
- Nodemailer, Brevo API, Resend API
- `qrcode`, `pdfkit`, `node-cron`

### Deployment
- **Frontend**: Vercel (with `vercel.json` SPA rewrites for direct URL navigation)
- **Backend**: Render (with `trust proxy` for correct HTTPS detection behind reverse proxy)
- **Database**: MongoDB Atlas

---

## 📁 Project Structure

```
Campus-Event-Finder/
├── backend/
│   ├── config/          # Database connection
│   ├── controllers/     # Business logic (auth, events, registrations, attendance)
│   ├── cronJobs/        # Scheduled background tasks
│   ├── middleware/      # JWT auth, role validation
│   ├── models/          # Mongoose schemas (User, Event, Registration)
│   ├── routes/          # Express API route declarations
│   ├── services/        # Email service, reminder scheduler
│   ├── tests/           # Jest test suites
│   ├── uploads/         # QR codes and uploaded assets
│   ├── .env.example     # Environment variable template
│   └── server.js        # Express + Socket.IO entrypoint
│
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable UI (Navbar, QR Scanner, Modals, Alerts)
│   │   ├── context/     # Auth, Theme, Socket providers
│   │   ├── pages/       # All pages (Landing, Dashboards, Auth, Profile)
│   │   ├── routes/      # React Router + Protected Routes
│   │   ├── services/    # Axios API client modules
│   │   ├── types/       # TypeScript interfaces
│   │   └── utils/       # Helpers and error utilities
│   ├── vercel.json      # SPA fallback rewrites for Vercel
│   └── vite.config.ts   # Vite config + dev proxy
│
└── README.md
```

---

## ⚙️ Environment Setup

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in your values:

```env
PORT=5000

# MongoDB Atlas connection string
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/campus-events

# JWT secret — generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=your_long_random_secret

# Platform owner email (receives organizer approval requests)
PLATFORM_OWNER_EMAIL=your_email@example.com
SUPER_ADMIN_EMAIL=your_email@example.com

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Microsoft OAuth (Azure App Registration)
MICROSOFT_CLIENT_ID=your_microsoft_client_id

# Email provider — set to "brevo" to skip Resend
EMAIL_PROVIDER=brevo

# Gmail SMTP (fallback)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16char_app_password
EMAIL_FROM=Campus Event Finder <noreply@campuseventfinder.com>

# Brevo API (primary — get key at https://app.brevo.com/settings/keys/api)
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER=your_verified_sender@example.com

# Resend API (optional fallback)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM=Campus Event Finder <noreply@yourdomain.com>

# Production URLs
FRONTEND_URL=https://your-app.vercel.app
APP_URL=https://your-app.vercel.app
BACKEND_URL=https://your-backend.onrender.com
```

### Frontend (`frontend/.env`)

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## 🚀 Local Development

### 1. Clone

```bash
git clone https://github.com/SUSHANT-M-GIT/CAMPUS-EVENT-FINDER-.git
cd Campus-event-Finder-and-Manager-clean-branch
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

Create `frontend/.env`:
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_API_URL=http://localhost:5000/api
```

### 4. Run dev servers

**Terminal 1 — Backend (port 5000):**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd frontend
npm run dev
```

The Vite dev proxy routes `/api/*` to `http://localhost:5000` automatically.

---

## 🧪 Tests

```bash
# Backend tests (auth, QR, attendance, OAuth flows)
cd backend
npm test

# Frontend TypeScript build check
cd frontend
npm run build
```

---

## 🚢 Production Deployment

### Render (Backend)

1. Connect GitHub repo → set **Root Directory** to `backend`
2. **Start command**: `npm start`
3. Add all environment variables from `backend/.env.example` in the Render dashboard
4. Key variables to set:
   - `FRONTEND_URL` = `https://c-e-s.vercel.app`
   - `BACKEND_URL` = `https://campus-event-finder-r2j3.onrender.com`
   - `EMAIL_PROVIDER` = `brevo`
   - `MONGO_URI`, `JWT_SECRET`, `BREVO_API_KEY`, `GOOGLE_CLIENT_ID`

### Vercel (Frontend)

1. Connect GitHub repo → set **Root Directory** to `frontend`
2. Framework: **Vite**
3. Add environment variables:
   - `VITE_API_URL` = `https://campus-event-finder-r2j3.onrender.com/api`
   - `VITE_GOOGLE_CLIENT_ID` = your Google client ID
4. The included `vercel.json` handles SPA routing automatically

### Google OAuth (Console)

In [Google Cloud Console](https://console.cloud.google.com) → Credentials → your OAuth client:
- **Authorized JavaScript origins**: `https://c-e-s.vercel.app`
- **Authorized redirect URIs**: `https://c-e-s.vercel.app`

---

## 📡 API Reference

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register with OTP | Public |
| `POST` | `/api/auth/verify-email` | Verify OTP | Public |
| `POST` | `/api/auth/login` | Login, receive JWT | Public |
| `POST` | `/api/auth/google` | Google OAuth | Public |
| `POST` | `/api/auth/microsoft` | Microsoft OAuth | Public |
| `POST` | `/api/auth/forgot-password` | Send reset email | Public |
| `POST` | `/api/auth/reset-password` | Set new password | Public |
| `GET` | `/api/auth/me` | Get profile | Authenticated |
| `GET` | `/api/auth/organizer-approval/approve/:token` | Approve organizer | Token |
| `GET` | `/api/auth/organizer-approval/reject/:token` | Reject organizer | Token |
| `GET` | `/api/events` | List events | Public |
| `POST` | `/api/events` | Create event | Admin |
| `POST` | `/api/registrations/:eventId` | Register for event | Student/Pro |
| `GET` | `/api/my-registrations` | My registrations | Student/Pro |
| `POST` | `/api/attendance/scan` | Scan QR attendance | Admin |
| `GET` | `/api/attendance/qr-image/:id` | Serve QR PNG | Public |
| `GET` | `/api/attendance/certificate/:id` | Download certificate | Attendee |

---

## 🛡️ Security

- SHA-256 one-time tokens for organizer approval and password reset
- JWT authentication with role-based middleware
- Rate limiting (100 req/min per IP)
- NoSQL injection protection (`express-mongo-sanitize`)
- Security headers (`helmet`)
- Environment variable isolation — no secrets in source code

---

## 📄 License

MIT License — open source and free to use.
