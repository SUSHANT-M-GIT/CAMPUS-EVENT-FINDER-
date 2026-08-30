const mockSave = jest.fn();
var mockUserModel = function MockUser(data) {
  Object.assign(this, data);
  this.save = mockSave;
};

mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();

jest.mock('../models/User', () => mockUserModel);
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Mock global fetch for Microsoft Graph API
global.fetch = jest.fn();

process.env.JWT_SECRET = 'test_jwt_secret_key_123';
process.env.MICROSOFT_CLIENT_ID = 'test_microsoft_client_id';

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

describe('Microsoft Authentication Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects request if no token is provided', async () => {
    const req = { body: {} };
    const res = createMockRes();

    await controller.microsoftAuth(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.result.msg).toMatch(/token is required/i);
  });

  it('logs in an existing active user successfully with JWT', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'ms-user-id-123',
        displayName: 'Alice Student',
        mail: 'alice@university.edu',
        userPrincipalName: 'alice@university.edu',
      }),
    });

    const existingUser = {
      _id: 'user-ms-1',
      id: 'user-ms-1',
      name: 'Alice Student',
      email: 'alice@university.edu',
      role: 'student',
      collegeName: 'Tech University',
      isVerified: true,
      accountStatus: 'active',
      save: mockSave.mockResolvedValue(true),
    };
    mockUserModel.findOne.mockResolvedValue(existingUser);

    const req = { body: { accessToken: 'valid-ms-access-token' } };
    const res = createMockRes();

    await controller.microsoftAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result).toHaveProperty('token');
    expect(res.result.isNewUser).toBe(false);
  });

  it('blocks suspended or deactivated users from logging in via Microsoft', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'ms-user-id-456',
        displayName: 'Suspended Student',
        userPrincipalName: 'suspended@university.edu',
      }),
    });

    const suspendedUser = {
      _id: 'user-ms-2',
      id: 'user-ms-2',
      email: 'suspended@university.edu',
      role: 'student',
      accountStatus: 'suspended',
      save: mockSave.mockResolvedValue(true),
    };
    mockUserModel.findOne.mockResolvedValue(suspendedUser);

    const req = { body: { accessToken: 'valid-ms-access-token' } };
    const res = createMockRes();

    await controller.microsoftAuth(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.result.msg).toMatch(/suspended/i);
  });

  it('prompts for profile completion when a new Microsoft user signs in without required college info', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'ms-user-id-789',
        displayName: 'New Student',
        mail: 'newstudent@college.edu',
      }),
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const req = { body: { accessToken: 'valid-ms-access-token' } };
    const res = createMockRes();

    await controller.microsoftAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result.needsProfileCompletion).toBe(true);
    expect(res.result.msEmail).toBe('newstudent@college.edu');
    expect(res.result.provider).toBe('microsoft');
  });

  it('successfully creates a new Student account with provided Microsoft credentials & college info', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'ms-user-id-789',
        displayName: 'New Student',
        mail: 'newstudent@college.edu',
      }),
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const req = {
      body: {
        accessToken: 'valid-ms-access-token',
        role: 'student',
        collegeName: 'State College of Technology',
        collegeId: 'SCT2026',
      },
    };
    const res = createMockRes();

    await controller.microsoftAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result).toHaveProperty('token');
    expect(res.result.isNewUser).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });

  it('successfully creates a new Admin/Organizer account with Microsoft credentials and sets pending approval', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'ms-user-id-admin',
        displayName: 'Admin User',
        mail: 'admin@organization.org',
      }),
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const req = {
      body: {
        accessToken: 'valid-ms-access-token',
        role: 'admin',
        collegeName: 'State Tech Club',
        phone: '+91 9876543210',
      },
    };
    const res = createMockRes();

    await controller.microsoftAuth(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result.pendingApproval).toBe(true);
    expect(res.result.isNewUser).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });
});
