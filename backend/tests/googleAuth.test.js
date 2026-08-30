const mockSave = jest.fn();
var mockUserModel = function MockUser(data) {
  Object.assign(this, data);
  this.save = mockSave;
};

mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();

const mockVerifyIdToken = jest.fn();

jest.mock('../models/User', () => mockUserModel);
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
  };
});

process.env.JWT_SECRET = 'test_jwt_secret_key_123';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id.apps.googleusercontent.com';

const controller = require('../controllers/authController');

function createMockRes() {
  return {
    statusCode: 200,
    result: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.result = payload;
      return this;
    },
  };
}

describe('Google Authentication Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects request if no token is provided', async () => {
    const req = { body: {} };
    const res = createMockRes();

    await controller.googleAuth(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.result.msg).toMatch(/token is required/i);
  });

  it('logs in an existing active user successfully with JWT', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'student@example.com',
        name: 'John Doe',
        sub: 'google-uid-123',
      }),
    });

    const existingUser = {
      _id: 'user-1',
      id: 'user-1',
      name: 'John Doe',
      email: 'student@example.com',
      role: 'student',
      collegeName: 'Test University',
      isVerified: true,
      accountStatus: 'active',
      save: mockSave.mockResolvedValue(true),
    };
    mockUserModel.findOne.mockResolvedValue(existingUser);

    const req = { body: { idToken: 'valid-google-id-token' } };
    const res = createMockRes();

    await controller.googleAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result).toHaveProperty('token');
    expect(res.result.isNewUser).toBe(false);
  });

  it('blocks suspended or deactivated users from logging in via Google', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'suspended@example.com',
        name: 'Suspended User',
      }),
    });

    const suspendedUser = {
      _id: 'user-2',
      id: 'user-2',
      email: 'suspended@example.com',
      role: 'student',
      accountStatus: 'suspended',
      save: mockSave.mockResolvedValue(true),
    };
    mockUserModel.findOne.mockResolvedValue(suspendedUser);

    const req = { body: { idToken: 'valid-google-id-token' } };
    const res = createMockRes();

    await controller.googleAuth(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.result.msg).toMatch(/suspended/i);
  });

  it('prompts for profile completion when a new user signs in without required fields', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'newuser@example.com',
        name: 'New Student',
      }),
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const req = { body: { idToken: 'valid-google-id-token' } };
    const res = createMockRes();

    await controller.googleAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result.needsProfileCompletion).toBe(true);
    expect(res.result.googleEmail).toBe('newuser@example.com');
  });

  it('successfully creates a new Student account with provided college info', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'newstudent@example.com',
        name: 'Jane Student',
      }),
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const req = {
      body: {
        idToken: 'valid-google-id-token',
        role: 'student',
        collegeName: 'State College',
        collegeId: 'SC12345',
      },
    };
    const res = createMockRes();

    await controller.googleAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result).toHaveProperty('token');
    expect(res.result.isNewUser).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });

  it('successfully creates a new Admin/Organizer account with provided organization info', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'organizer@example.com',
        name: 'Jane Organizer',
      }),
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const req = {
      body: {
        idToken: 'valid-google-id-token',
        role: 'admin',
        collegeName: 'State Tech Club',
      },
    };
    const res = createMockRes();

    await controller.googleAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result).toHaveProperty('token');
    expect(res.result.isNewUser).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });

  it('successfully creates a new Professional account with provided designation', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'pro@example.com',
        name: 'Pro Worker',
      }),
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const req = {
      body: {
        idToken: 'valid-google-id-token',
        role: 'professional',
        designation: 'Senior Developer',
        company: 'Google',
      },
    };
    const res = createMockRes();

    await controller.googleAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result).toHaveProperty('token');
    expect(res.result.isNewUser).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });
});
