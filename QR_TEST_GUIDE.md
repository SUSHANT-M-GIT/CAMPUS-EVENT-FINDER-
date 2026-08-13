# QR Test Guide

## What is fixed
The QR flow now uses real image files instead of broken data-URL style behavior.

### Flow
1. QR is generated on the backend.
2. PNG is saved in `backend/uploads/qr-codes/`.
3. DB stores the file path like `/uploads/qr-codes/qr-123.png`.
4. Email uses a full URL like `http://localhost:5000/uploads/qr-codes/qr-123.png`.
5. Express serves the file from `/uploads`.

---

## Quick test

### 1) Start app
```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

### 2) Create test event
- Log in as admin
- Create an event
- Keep capacity small for easy testing

### 3) Register as student
- Log in as student
- Register for the event

### 4) Check QR creation
Look in:
```bash
backend/uploads/qr-codes
```
You should see a new `.png` file.

### 5) Open QR directly in browser
Visit:
```text
http://localhost:5000/uploads/qr-codes/qr-<id>.png
```
It should open as an image.

### 6) Check backend logs
You should see QR generation logs and email logs.

---

## Expected behavior
- QR file is created successfully
- QR URL is stored correctly
- Email contains the QR image URL
- Browser can open the QR image directly

---

## Important note
On localhost, Gmail may still show a broken image because `localhost` is not public. That is expected.

For real email preview, deploy with a public domain and set:
```env
APP_URL=https://your-domain.com
```

---

## If it fails
- Check `APP_URL` in backend `.env`
- Check if `backend/uploads/qr-codes` exists
- Check backend logs for `[QR]` or `[Email]` errors
- Make sure backend is running on port 5000

---

## Success
This is working when:
- QR PNG file exists
- browser can open it
- backend logs show QR generated successfully
- email sends with the QR URL
