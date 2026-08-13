const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const Registration = require('../models/Registration');
const { sendConfirmationEmail } = require('../services/emailService');

describe('QR generation and email delivery', () => {
  test('stores QR file metadata on the registration document', () => {
    const reg = new Registration({ attendanceQr: '/uploads/qr-codes/qr-123.png', attendanceQrFile: '/uploads/qr-codes/qr-123.png' });

    expect(reg.attendanceQr).toBe('/uploads/qr-codes/qr-123.png');
    expect(reg.attendanceQrFile).toBe('/uploads/qr-codes/qr-123.png');
  });

  test('creates a valid QR PNG file and keeps the email function stable', async () => {
    const qrDir = path.join(__dirname, '..', 'uploads', 'qr-codes');
    fs.mkdirSync(qrDir, { recursive: true });

    const payload = JSON.stringify({ registrationId: 'qr-test-123', registrationCode: 'REG-ABC123', eventId: 'event-1', studentName: 'Student' });
    const filePath = path.join(qrDir, 'qr-qr-test-123.png');
    const buffer = await QRCode.toBuffer(payload, { width: 300, margin: 2, type: 'image/png' });
    fs.writeFileSync(filePath, buffer);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath).subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);

    await expect(
      sendConfirmationEmail('student@example.com', { title: 'Demo Event' }, {
        name: 'Student',
        registrationCode: 'REG-ABC123',
        attendanceQr: 'http://localhost:5000/uploads/qr-codes/qr-qr-test-123.png',
      })
    ).resolves.toBeUndefined();
  });
});
