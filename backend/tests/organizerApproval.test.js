const {
  register,
  verifyEmail,
  login,
  handleOrganizerApproval,
  handleOrganizerRejection,
  googleAuth,
  microsoftAuth,
} = require('../controllers/authController');
const User = require('../models/User');
const emailService = require('../services/emailService');
const crypto = require('crypto');

jest.mock('../models/User');
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendOrganizerApprovalRequestEmail: jest.fn().mockResolvedValue(true),
  sendOrganizerApprovedNotificationEmail: jest.fn().mockResolvedValue(true),
  sendOrganizerRejectedNotificationEmail: jest.fn().mockResolvedValue(true),
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock google-auth-library
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'organizer@test.com',
          name: 'Organizer Test',
        }),
      }),
    })),
  };
});

function createMockRes() {
  return {
    statusCode: 200,
    result: null,
    html: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.result = payload;
      return this;
    },
    send(htmlContent) {
      this.html = htmlContent;
      return this;
    },
  };
}

describe('Organizer 1-Click Email Approval System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret_123';
    process.env.PLATFORM_OWNER_EMAIL = 'owner@campus.edu';
    process.env.APP_URL = 'http://localhost:5000';
  });

  describe('1. Organizer Signup & Verification Flow', () => {
    it('requires phone number for Admin/Organizer registration', async () => {
      const req = {
        body: {
          name: 'New Organizer',
          email: 'org@campus.edu',
          password: 'Password123',
          role: 'admin',
          collegeName: 'Campus Tech Club',
          // Missing phone
        },
      };
      const res = createMockRes();

      await register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.result.msg).toMatch(/phone number is required/i);
    });

    it('creates organizer account in pending status upon email verification and sends email to platform owner', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const userMock = {
        _id: 'user_org_1',
        name: 'Jane Organizer',
        email: 'jane@club.edu',
        role: 'admin',
        collegeName: 'Robotics Club',
        phone: '+91 9876543210',
        isVerified: false,
        otp: '123456',
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        verificationStatus: 'pending',
        organizerApprovalStatus: 'pending',
        save: mockSave,
      };

      User.findOne.mockResolvedValue(userMock);

      const req = { body: { email: 'jane@club.edu', otp: '123456' } };
      const res = createMockRes();

      await verifyEmail(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.result.pendingApproval).toBe(true);
      expect(userMock.isVerified).toBe(true);
      expect(userMock.organizerApprovalTokenHash).toBeTruthy();
      expect(emailService.sendOrganizerApprovalRequestEmail).toHaveBeenCalled();
    });
  });

  describe('2. Organizer Login Blocking while Pending or Rejected', () => {
    it('blocks pending organizer from logging in', async () => {
      const userMock = {
        _id: 'user_org_1',
        name: 'Pending Org',
        email: 'pending@club.edu',
        password: 'hashed_password',
        role: 'admin',
        isVerified: true,
        accountStatus: 'active',
        verificationStatus: 'pending',
        organizerApprovalStatus: 'pending',
      };
      User.findOne.mockResolvedValue(userMock);

      const req = { body: { email: 'pending@club.edu', password: 'Password123' } };
      const res = createMockRes();

      await login(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.result.msg).toMatch(/waiting for approval/i);
    });

    it('blocks rejected organizer from logging in', async () => {
      const userMock = {
        _id: 'user_org_2',
        name: 'Rejected Org',
        email: 'rejected@club.edu',
        password: 'hashed_password',
        role: 'admin',
        isVerified: true,
        accountStatus: 'active',
        verificationStatus: 'rejected',
        organizerApprovalStatus: 'rejected',
      };
      User.findOne.mockResolvedValue(userMock);

      const req = { body: { email: 'rejected@club.edu', password: 'Password123' } };
      const res = createMockRes();

      await login(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.result.msg).toMatch(/not approved/i);
    });

    it('allows approved organizer to log in normally with JWT', async () => {
      const userMock = {
        _id: 'user_org_3',
        id: 'user_org_3',
        name: 'Approved Org',
        email: 'approved@club.edu',
        password: 'hashed_password',
        role: 'admin',
        isVerified: true,
        accountStatus: 'active',
        verificationStatus: 'approved',
        organizerApprovalStatus: 'approved',
      };
      User.findOne.mockResolvedValue(userMock);

      const req = { body: { email: 'approved@club.edu', password: 'Password123' } };
      const res = createMockRes();

      await login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.result).toHaveProperty('token');
    });
  });

  describe('3. 1-Click Secure Approval Endpoint', () => {
    it('approves organizer with valid one-time token, notifies organizer, and invalidates token', async () => {
      const rawToken = 'valid_raw_token_12345';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const mockSave = jest.fn().mockResolvedValue(true);

      const userMock = {
        _id: 'user_org_1',
        name: 'Rahul Sharma',
        email: 'rahul@reva.edu',
        clubName: 'Robotics Club',
        organizerApprovalTokenHash: tokenHash,
        organizerApprovalTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verificationStatus: 'pending',
        organizerApprovalStatus: 'pending',
        save: mockSave,
      };

      User.findOne.mockResolvedValue(userMock);

      const req = { params: { token: rawToken } };
      const res = createMockRes();

      await handleOrganizerApproval(req, res);

      expect(userMock.verificationStatus).toBe('approved');
      expect(userMock.organizerApprovalStatus).toBe('approved');
      expect(userMock.organizerApprovalTokenHash).toBeNull();
      expect(emailService.sendOrganizerApprovedNotificationEmail).toHaveBeenCalledWith(userMock);
      expect(res.html).toContain('Organizer Approved');
    });

    it('rejects invalid or already-used token with safety message', async () => {
      User.findOne.mockResolvedValue(null);

      const req = { params: { token: 'invalid_or_already_used_token' } };
      const res = createMockRes();

      await handleOrganizerApproval(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.html).toContain('Link Already Used or Invalid');
    });

    it('rejects expired token', async () => {
      const rawToken = 'expired_raw_token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const userMock = {
        _id: 'user_org_1',
        name: 'Expired Org',
        organizerApprovalTokenHash: tokenHash,
        organizerApprovalTokenExpiry: new Date(Date.now() - 1000), // Expired
      };
      User.findOne.mockResolvedValue(userMock);

      const req = { params: { token: rawToken } };
      const res = createMockRes();

      await handleOrganizerApproval(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.html).toContain('Expired');
    });
  });

  describe('4. 1-Click Secure Rejection Endpoint', () => {
    it('rejects organizer with valid token, updates status, and notifies organizer', async () => {
      const rawToken = 'reject_token_123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const mockSave = jest.fn().mockResolvedValue(true);

      const userMock = {
        _id: 'user_org_1',
        name: 'Spam Applicant',
        email: 'spam@fake.com',
        organizerApprovalTokenHash: tokenHash,
        organizerApprovalTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verificationStatus: 'pending',
        organizerApprovalStatus: 'pending',
        save: mockSave,
      };

      User.findOne.mockResolvedValue(userMock);

      const req = { params: { token: rawToken } };
      const res = createMockRes();

      await handleOrganizerRejection(req, res);

      expect(userMock.verificationStatus).toBe('rejected');
      expect(userMock.organizerApprovalStatus).toBe('rejected');
      expect(userMock.organizerApprovalTokenHash).toBeNull();
      expect(emailService.sendOrganizerRejectedNotificationEmail).toHaveBeenCalledWith(userMock);
      expect(res.html).toContain('Rejected');
    });
  });
});
