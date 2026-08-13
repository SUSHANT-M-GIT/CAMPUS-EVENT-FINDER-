# Campus Event Finder & Manager

A full-stack campus event platform built with Node.js, Express, MongoDB, React, and Vite. It allows students to discover events, register, manage attendance, and receive QR-based confirmation, while admins can create events, review registrations, and mark attendance.

## Tech Stack

- Backend: Node.js, Express.js, Mongoose, MongoDB
- Frontend: React, TypeScript, Vite
- Real-time updates: Socket.IO
- QR generation: qrcode
- Email: Nodemailer
- PDF certificates: pdfkit

## What the app does

### Student flow
- Sign up and log in
- View available events
- Filter and search events
- Register for events
- Receive confirmation email with QR code
- View personal registration status and QR
- Download certificate after attendance is marked

### Admin flow
- Create and manage events
- View registrations and event stats
- Enable certificates
- Open QR scanner to mark attendance
- Review attendance list and present/absent states

## Project structure

Campus-Event-Finder
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── cronJobs/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── tests/
│   ├── uploads/
│   ├── .env
│   ├── package.json
│   ├── server.js
│  
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── 
├── README.md
├── QR_TEST_GUIDE.md
└── package.json (if present in root)
```

## Prerequisites

Before running the app, make sure you have:

- Node.js 18+
- npm
- MongoDB running locally or a MongoDB connection string
- A working email account for SMTP if you want email sending enabled

## Environment setup

Create a `.env` file inside the backend folder with values like:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/campus-event-finder
JWT_SECRET=your_super_secret_key
APP_URL=http://localhost:5000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

If you are using a different mail provider, adjust the SMTP values accordingly.

## Install dependencies

From the project root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Run the app

### Start backend

```bash
cd backend
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

### Start frontend

```bash
cd frontend
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

## Useful commands

### Backend

```bash
cd backend
npm run dev
npm start
npm test
npm run lint
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

## Main app flow

1. Admin creates an event.
2. Students log in and browse the event catalog.
3. Students register for a confirmed event.
4. Backend generates a QR code and stores it in the upload directory.
5. Confirmation email is sent with the generated QR image.
6. Admin opens the attendance scanner and scans the QR.
7. The backend validates the registration and marks attendance.
8. If certificates are enabled, students can download their PDF certificate.

## QR and attendance notes

- QR codes are generated server-side and stored under the backend upload folder.
- The attendance scanner accepts the generated QR payload and also supports legacy/manual values.
- The app serves uploaded files through the backend at `/uploads`.

## Troubleshooting

### Backend not connecting to MongoDB
- Make sure MongoDB is running.
- Confirm `MONGO_URI` is correct.

### QR not showing
- Check backend `.env` for `APP_URL`.
- Verify uploads are served from the backend server.
- Confirm the QR file was generated under `backend/uploads/qr-codes`.

### Camera scan not working
- Allow camera permission in the browser.
- Use a clear QR image under good lighting.
- Make sure the QR belongs to the current event and the registration is valid for attendance.

## Notes

- This project is designed for campus events with role-based access for students and admins.
- The backend and frontend are separate services and must both be running for full app functionality.
- The app includes real-time notifications, QR attendance, email confirmation, and certificate flow.

## License

This project is intended for local educational or campus usage and can be extended for production deployment with additional security and environment hardening.
